import time
import logging
from cdlib import algorithms, evaluation
from backend.services.ingestion import GraphDataService
from database.session import SessionLocal
from backend.models.sql_models import Experiment

logger = logging.getLogger(__name__)

def run_community_detection(dataset_id: int, algo_name: str):
    # 1. Fetch graph from Neo4j
    service = GraphDataService()
    G = service.get_networkx_graph()
    
    if len(G.nodes) == 0:
        raise ValueError("Graph is empty or not found in Neo4j.")

    start_time = time.time()
    
    # 2. Execute the requested algorithm
    algo_name = algo_name.lower()
    if algo_name == "louvain":
        coms = algorithms.louvain(G, resolution=1.0)
    elif algo_name == "leiden":
        coms = algorithms.leiden(G)
    elif algo_name == "infomap":
        raise ValueError("Infomap is not supported on Windows (requires Linux/macOS).")
    elif algo_name == "label_propagation":
        coms = algorithms.label_propagation(G)
    elif algo_name == "walktrap":
        coms = algorithms.walktrap(G)
    elif algo_name == "slpa":
        coms = algorithms.slpa(G) # Note: SLPA is overlapping
    else:
        raise ValueError(f"Algorithm {algo_name} is not supported.")
        
    exec_time_ms = int((time.time() - start_time) * 1000)

    # 3. Calculate Evaluation Metrics (handling overlapping/non-overlapping)
    try:
        modularity = evaluation.newman_girvan_modularity(G, coms).score
    except Exception:
        logger.warning("Modularity calculation failed for algo '%s'", algo_name)
        modularity = 0.0

    try:
        internal_density = evaluation.internal_edge_density(G, coms).score
    except Exception:
        logger.warning("Internal density calculation failed for algo '%s'", algo_name)
        internal_density = 0.0

    try:
        conductance = evaluation.conductance(G, coms).score
    except Exception:
        logger.warning("Conductance calculation failed for algo '%s'", algo_name)
        conductance = 0.0

    try:
        coverage = evaluation.coverage(G, coms).score
    except Exception:
        logger.warning("Coverage calculation failed for algo '%s'", algo_name)
        coverage = 0.0

    # 4. Save Metrics to PostgreSQL
    db = SessionLocal()
    try:
        experiment = Experiment(
            dataset_id=dataset_id,
            algorithm=algo_name,
            modularity=modularity,
            conductance=conductance,
            execution_time_ms=exec_time_ms
        )
        db.add(experiment)
        db.commit()
    finally:
        db.close()

    # 5. Update Neo4j with Community Assignments
    # Flatten the communities list (list of lists) into a batch of dicts
    batch = []
    for comm_id, node_list in enumerate(coms.communities):
        for node in node_list:
            batch.append({
                "node_id": str(node), 
                "community_id": comm_id
            })

    # Push to Neo4j using UNWIND for fast batch updating
    update_query = """
    UNWIND $batch AS row
    MATCH (n:Node {node_id: row.node_id})
    SET n.community_id = row.community_id
    """
    
    with service.driver.session() as session:
        session.run(update_query, batch=batch)
        
    service.close()
    
    return {
        "status": "success", 
        "algorithm": algo_name, 
        "communities_found": len(coms.communities),
        "modularity": modularity
    }