from fastapi import APIRouter, HTTPException
from backend.services.ingestion import GraphDataService

router = APIRouter()

@router.get("/visualization/{dataset_id}")
async def get_graph_visualization(dataset_id: int, limit: int = 500):
    service = GraphDataService()
    
    # New query: Grab valid paths so the graph looks like a real web!
    query = """
    MATCH (n1:Node)-[:CONNECTED_TO]->(n2:Node)
    RETURN n1.node_id AS source, coalesce(n1.community_id, 0) AS source_comm,
           n2.node_id AS target, coalesce(n2.community_id, 0) AS target_comm
    LIMIT $limit
    """
    
    with service.driver.session() as session:
        results = session.run(query, limit=limit).data()
        
    service.close()

    if not results:
        raise HTTPException(status_code=404, detail="No graph data found.")

    elements = []
    seen_nodes = set()
    
    for row in results:
        # 1. Add Source Node (if we haven't already)
        if row["source"] not in seen_nodes:
            elements.append({"data": {"id": str(row["source"]), "label": str(row["source"]), "community": row["source_comm"]}})
            seen_nodes.add(row["source"])
            
        # 2. Add Target Node (if we haven't already)
        if row["target"] not in seen_nodes:
            elements.append({"data": {"id": str(row["target"]), "label": str(row["target"]), "community": row["target_comm"]}})
            seen_nodes.add(row["target"])
            
        # 3. Add the Edge connecting them
        elements.append({"data": {"source": str(row["source"]), "target": str(row["target"])}})

    return {"elements": elements}