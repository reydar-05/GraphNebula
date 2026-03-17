from neo4j import GraphDatabase
import os

URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
AUTH = ("neo4j", os.environ["NEO4J_PASSWORD"])

def initialize_constraints():
    driver = GraphDatabase.driver(URI, auth=AUTH)
    with driver.session() as session:
        # Using Neo4j 5.x syntax for constraints
        session.run("CREATE CONSTRAINT node_id_unique IF NOT EXISTS FOR (n:Node) REQUIRE n.node_id IS UNIQUE")
        session.run("CREATE CONSTRAINT comm_id_unique IF NOT EXISTS FOR (c:Community) REQUIRE c.comm_id IS UNIQUE")
    print("Neo4j constraints successfully initialized.")
    driver.close()

if __name__ == "__main__":
    initialize_constraints()