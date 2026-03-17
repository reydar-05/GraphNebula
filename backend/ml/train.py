import torch
import os
from torch_geometric.data import Data
from torch_geometric.nn import Node2Vec
from backend.services.ingestion import GraphDataService
from backend.ml.models import GraphSAGE
import torch.nn.functional as F  # <--- ADD THIS LINE


# Ensure the models directory exists for saving weights
os.makedirs("backend/models/saved", exist_ok=True)

def fetch_pyg_data_from_neo4j():
    """Fetches nodes, edges, and community labels from Neo4j and converts to PyG Data."""
    service = GraphDataService()
    
    # Get nodes and their ground truth communities (from Phase 3)
    node_query = "MATCH (n:Node) WHERE n.community_id IS NOT NULL RETURN n.node_id AS id, n.community_id AS label"
    edge_query = "MATCH (n1:Node)-[:CONNECTED_TO]->(n2:Node) RETURN n1.node_id AS source, n2.node_id AS target"
    
    with service.driver.session() as session:
        nodes_result = session.run(node_query).data()
        edges_result = session.run(edge_query).data()
        
    service.close()

    if not nodes_result:
        raise ValueError("No community labels found in Neo4j. Run a clustering algorithm first (Phase 3).")

    # Map string Node IDs to contiguous integers [0, N-1] for PyTorch
    node_mapping = {record['id']: idx for idx, record in enumerate(nodes_result)}
    labels = [record['label'] for record in nodes_result]
    
    # Build edge_index tensor: shape [2, num_edges]
    source_nodes = [node_mapping[edge['source']] for edge in edges_result if edge['source'] in node_mapping]
    target_nodes = [node_mapping[edge['target']] for edge in edges_result if edge['target'] in node_mapping]
    
    # Undirected graph requires edges in both directions
    edge_index = torch.tensor([source_nodes + target_nodes, target_nodes + source_nodes], dtype=torch.long)
    y = torch.tensor(labels, dtype=torch.long)
    
    # Create masks for training (80%) and testing (20%)
    num_nodes = len(nodes_result)
    indices = torch.randperm(num_nodes)
    train_size = int(0.8 * num_nodes)
    
    train_mask = torch.zeros(num_nodes, dtype=torch.bool)
    test_mask = torch.zeros(num_nodes, dtype=torch.bool)
    train_mask[indices[:train_size]] = True
    test_mask[indices[train_size:]] = True

    return Data(edge_index=edge_index, y=y, train_mask=train_mask, test_mask=test_mask), len(set(labels))

def train_gnn_pipeline(dataset_id: int):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    print(f"Fetching graph data for dataset {dataset_id}...")
    data, num_classes = fetch_pyg_data_from_neo4j()
    data = data.to(device)

    # --- 1. Train Node2Vec to get Node Embeddings ---
    print("Training Node2Vec embeddings...")
    embedding_dim = 64
    n2v = Node2Vec(data.edge_index, embedding_dim=embedding_dim, walk_length=20,
                   context_size=10, walks_per_node=10, num_negative_samples=1,
                   p=1, q=1, sparse=True).to(device)
    
    n2v_optimizer = torch.optim.SparseAdam(list(n2v.parameters()), lr=0.01)
    n2v_loader = n2v.loader(batch_size=128, shuffle=True)

    n2v.train()
    for epoch in range(5):  # Keep low for demonstration; increase for production
        for pos_rw, neg_rw in n2v_loader:
            n2v_optimizer.zero_grad()
            loss = n2v.loss(pos_rw.to(device), neg_rw.to(device))
            loss.backward()
            n2v_optimizer.step()

    # Get the generated features
    n2v.eval()
    with torch.no_grad():
        data.x = n2v() # Set Node2Vec embeddings as the node features (x)

    # --- 2. Train GraphSAGE for Community Prediction ---
    print("Training GraphSAGE model...")
    model = GraphSAGE(in_channels=embedding_dim, hidden_channels=32, out_channels=num_classes).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

    model.train()
    for epoch in range(50):
        optimizer.zero_grad()
        out = model(data.x, data.edge_index)
        loss = F.nll_loss(out[data.train_mask], data.y[data.train_mask])
        loss.backward()
        optimizer.step()
        
        if epoch % 10 == 0:
            print(f"Epoch {epoch:03d}, Loss: {loss.item():.4f}")

    # Evaluate accuracy
    model.eval()
    _, pred = model(data.x, data.edge_index).max(dim=1)
    correct = int(pred[data.test_mask].eq(data.y[data.test_mask]).sum().item())
    acc = correct / int(data.test_mask.sum())
    print(f"GraphSAGE Test Accuracy: {acc:.4f}")

    # --- 3. Save the Models ---
    torch.save(n2v.state_dict(), f"backend/models/saved/node2vec_ds{dataset_id}.pt")
    torch.save(model.state_dict(), f"backend/models/saved/graphsage_ds{dataset_id}.pt")
    
    return {"status": "success", "accuracy": acc, "loss": loss.item()}