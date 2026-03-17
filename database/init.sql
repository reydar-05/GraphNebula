CREATE TABLE datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    num_nodes INT,
    num_edges INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE experiments (
    id SERIAL PRIMARY KEY,
    dataset_id INT REFERENCES datasets(id),
    algorithm VARCHAR(100),
    modularity FLOAT,
    conductance FLOAT,
    execution_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);