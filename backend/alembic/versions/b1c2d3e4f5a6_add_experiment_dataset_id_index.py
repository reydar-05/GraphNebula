"""add index on experiments.dataset_id

Revision ID: b1c2d3e4f5a6
Revises: 20fb121c7db2
Create Date: 2026-03-17

"""
from alembic import op

revision = 'b1c2d3e4f5a6'
down_revision = '20fb121c7db2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_experiments_dataset_id', 'experiments', ['dataset_id'], unique=False)


def downgrade():
    op.drop_index('ix_experiments_dataset_id', table_name='experiments')
