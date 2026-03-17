import pandas as pd
from neo4j import GraphDatabase
import networkx as nx
from backend.models.sql_models import Dataset
import os

NEO4J_URI = os.environ["NEO4J_URI"]
NEO4J_AUTH = ("neo4j", os.environ["NEO4J_PASSWORD"])

class GraphDataService:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=NEO4J_AUTH)

    def close(self):
        self.driver.close()

    def ingest_dataset(self, file_path: str, dataset_name: str, db_session):
        # 1. Parse the SNAP edge list (handles spaces/tabs, ignores # comments)
        df = pd.read_csv(file_path, sep=r'\s+', comment='#', header=None, names=['source', 'target'])
        
        # Ensure data types are strings for Neo4j consistency
        df['source'] = df['source'].astype(str)
        df['target'] = df['target'].astype(str)
        
        edges = df.to_dict('records')
        unique_nodes = set(df['source']).union(set(df['target']))
        
        num_nodes = len(unique_nodes)
        num_edges = len(edges)

        # 2. Save metadata to PostgreSQL
        new_dataset = Dataset(name=dataset_name, num_nodes=num_nodes, num_edges=num_edges)
        db_session.add(new_dataset)
        db_session.commit()
        db_session.refresh(new_dataset)

        # 3. Batch insert into Neo4j using UNWIND
        # We process in chunks to prevent memory crashes on millions of nodes
        chunk_size = 10000
        with self.driver.session() as session:
            for i in range(0, len(edges), chunk_size):
                chunk = edges[i:i + chunk_size]
                query = """
                UNWIND $batch AS edge
                MERGE (n1:Node {node_id: edge.source})
                MERGE (n2:Node {node_id: edge.target})
                MERGE (n1)-[:CONNECTED_TO]->(n2)
                """
                session.run(query, batch=chunk)

        return new_dataset

    def get_networkx_graph(self):
        """Adapter to pull the graph from Neo4j into a NetworkX object."""
        query = "MATCH (n1)-[:CONNECTED_TO]->(n2) RETURN n1.node_id AS source, n2.node_id AS target"
        
        with self.driver.session() as session:
            result = session.run(query)
            edges = [(record["source"], record["target"]) for record in result]
            
        # Build and return the undirected NetworkX graph
        G = nx.Graph()
        G.add_edges_from(edges)
        return G