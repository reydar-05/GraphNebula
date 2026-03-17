from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Dataset(Base):
    __tablename__ = 'datasets'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    num_nodes = Column(Integer)
    num_edges = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    experiments = relationship("Experiment", back_populates="dataset")

class Experiment(Base):
    __tablename__ = 'experiments'
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey('datasets.id'))
    algorithm = Column(String(100))
    modularity = Column(Float)
    conductance = Column(Float)
    execution_time_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dataset = relationship("Dataset", back_populates="experiments")