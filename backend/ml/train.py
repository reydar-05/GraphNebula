import torch
import os
import time
import mlflow
import mlflow.pytorch
from sklearn.model_selection import KFold
from torch_geometric.data import Data
from torch_geometric.nn import Node2Vec
from backend.services.ingestion import GraphDataService
from backend.ml.models import GraphSAGE
from database.session import SessionLocal
from backend.models.sql_models import Experiment
import torch.nn.functional as F

os.makedirs("backend/models/saved", exist_ok=True)

# ── MLflow setup ──────────────────────────────────────────────────────────────
MLFLOW_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
mlflow.set_tracking_uri(MLFLOW_URI)
mlflow.set_experiment("graphsage-community-detection")


def fetch_pyg_data_from_neo4j():
    """Fetches nodes, edges, and community labels from Neo4j and converts to PyG Data."""
    service = GraphDataService()

    node_query = "MATCH (n:Node) WHERE n.community_id IS NOT NULL RETURN n.node_id AS id, n.community_id AS label"
    edge_query = "MATCH (n1:Node)-[:CONNECTED_TO]->(n2:Node) RETURN n1.node_id AS source, n2.node_id AS target"

    with service.driver.session() as session:
        nodes_result = session.run(node_query).data()
        edges_result = session.run(edge_query).data()

    service.close()

    if not nodes_result:
        raise ValueError("No community labels found in Neo4j. Run a clustering algorithm first.")

    # Map string Node IDs to contiguous integers [0, N-1] for PyTorch
    node_mapping = {record['id']: idx for idx, record in enumerate(nodes_result)}
    labels = [record['label'] for record in nodes_result]

    # Build edge_index tensor: shape [2, num_edges]
    source_nodes = [node_mapping[edge['source']] for edge in edges_result if edge['source'] in node_mapping]
    target_nodes = [node_mapping[edge['target']] for edge in edges_result if edge['target'] in node_mapping]

    # Undirected graph: edges in both directions
    edge_index = torch.tensor([source_nodes + target_nodes, target_nodes + source_nodes], dtype=torch.long)
    y = torch.tensor(labels, dtype=torch.long)

    data = Data(edge_index=edge_index, y=y)
    return data, len(set(labels)), nodes_result, node_mapping


def train_gnn_pipeline(dataset_id: int):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    start_time = time.time()

    K = 5
    EMBEDDING_DIM = 64
    HIDDEN_CHANNELS = 32
    WALK_LENGTH = 20
    N2V_EPOCHS = 5
    SAGE_EPOCHS = 50

    print(f"Fetching graph data for dataset {dataset_id}...")
    data, num_classes, nodes_result, node_mapping = fetch_pyg_data_from_neo4j()
    num_nodes = data.y.size(0)

    with mlflow.start_run(run_name=f"dataset_{dataset_id}"):
        mlflow.log_params({
            "dataset_id": dataset_id,
            "embedding_dim": EMBEDDING_DIM,
            "walk_length": WALK_LENGTH,
            "n2v_epochs": N2V_EPOCHS,
            "sage_epochs": SAGE_EPOCHS,
            "hidden_channels": HIDDEN_CHANNELS,
            "k_folds": K,
            "num_classes": num_classes,
            "num_nodes": num_nodes,
        })

        # ── 1. Train Node2Vec to get Node Embeddings ──────────────────────────
        print("Training Node2Vec embeddings...")
        data = data.to(device)
        n2v = Node2Vec(
            data.edge_index, embedding_dim=EMBEDDING_DIM, walk_length=WALK_LENGTH,
            context_size=10, walks_per_node=10, num_negative_samples=1,
            p=1, q=1, sparse=True,
        ).to(device)

        n2v_optimizer = torch.optim.SparseAdam(list(n2v.parameters()), lr=0.01)
        n2v_loader = n2v.loader(batch_size=128, shuffle=True)

        n2v.train()
        for epoch in range(N2V_EPOCHS):
            epoch_loss = 0.0
            for pos_rw, neg_rw in n2v_loader:
                n2v_optimizer.zero_grad()
                loss = n2v.loss(pos_rw.to(device), neg_rw.to(device))
                loss.backward()
                n2v_optimizer.step()
                epoch_loss += loss.item()
            mlflow.log_metric("n2v_loss", epoch_loss, step=epoch)

        n2v.eval()
        with torch.no_grad():
            data.x = n2v()

        torch.save(n2v.state_dict(), f"backend/models/saved/node2vec_ds{dataset_id}.pt")
        mlflow.log_artifact(f"backend/models/saved/node2vec_ds{dataset_id}.pt")

        # ── 2. k-Fold Cross-Validation for GraphSAGE ─────────────────────────
        print(f"Running {K}-fold cross-validation for GraphSAGE...")
        kf = KFold(n_splits=K, shuffle=True, random_state=42)
        all_indices = list(range(num_nodes))
        fold_accuracies = []
        best_acc = 0.0
        best_state = None
        last_loss = 0.0

        for fold, (train_idx, test_idx) in enumerate(kf.split(all_indices)):
            train_mask = torch.zeros(num_nodes, dtype=torch.bool)
            test_mask = torch.zeros(num_nodes, dtype=torch.bool)
            train_mask[train_idx] = True
            test_mask[test_idx] = True
            data.train_mask = train_mask.to(device)
            data.test_mask = test_mask.to(device)

            model = GraphSAGE(EMBEDDING_DIM, HIDDEN_CHANNELS, num_classes).to(device)
            optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

            model.train()
            for epoch in range(SAGE_EPOCHS):
                optimizer.zero_grad()
                out = model(data.x, data.edge_index)
                loss = F.nll_loss(out[data.train_mask], data.y[data.train_mask])
                loss.backward()
                optimizer.step()
                last_loss = loss.item()
                if epoch % 10 == 0:
                    mlflow.log_metric(f"fold{fold}_train_loss", last_loss, step=epoch)
                    print(f"  Fold {fold+1}/{K} Epoch {epoch:03d} Loss: {last_loss:.4f}")

            model.eval()
            _, pred = model(data.x, data.edge_index).max(dim=1)
            correct = pred[data.test_mask].eq(data.y[data.test_mask]).sum().item()
            acc = correct / data.test_mask.sum().item()
            fold_accuracies.append(acc)
            mlflow.log_metric("fold_accuracy", acc, step=fold)
            print(f"  Fold {fold+1}/{K} Test Accuracy: {acc:.4f}")

            if acc > best_acc:
                best_acc = acc
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                best_pred = pred

        mean_acc = sum(fold_accuracies) / K
        print(f"Mean CV Accuracy: {mean_acc:.4f}  (best fold: {best_acc:.4f})")
        mlflow.log_metric("mean_cv_accuracy", mean_acc)
        mlflow.log_metric("best_fold_accuracy", best_acc)

        # Save best model
        torch.save(best_state, f"backend/models/saved/graphsage_ds{dataset_id}.pt")
        mlflow.log_artifact(f"backend/models/saved/graphsage_ds{dataset_id}.pt")

        # ── 3. Write best-fold predictions back to Neo4j ──────────────────────
        pred_list = best_pred.cpu().tolist()
        batch = [
            {"node_id": record["id"], "community_id": int(pred_list[node_mapping[record["id"]]])}
            for record in nodes_result
        ]
        service = GraphDataService()
        update_query = """
        UNWIND $batch AS row
        MATCH (n:Node {node_id: row.node_id})
        SET n.community_id = row.community_id
        """
        with service.driver.session() as neo_session:
            neo_session.run(update_query, batch=batch)
        service.close()

        # ── 4. Save experiment record to PostgreSQL ───────────────────────────
        exec_time_ms = int((time.time() - start_time) * 1000)
        db = SessionLocal()
        try:
            experiment = Experiment(
                dataset_id=dataset_id,
                algorithm="graphsage",
                modularity=float(mean_acc),
                conductance=0.0,
                execution_time_ms=exec_time_ms,
            )
            db.add(experiment)
            db.commit()
        finally:
            db.close()

        num_communities = len(set(pred_list))
        return {
            "status": "success",
            "algorithm": "graphsage",
            "mean_cv_accuracy": mean_acc,
            "best_fold_accuracy": best_acc,
            "fold_accuracies": fold_accuracies,
            "loss": last_loss,
            "communities_found": num_communities,
            "modularity": float(mean_acc),
        }
