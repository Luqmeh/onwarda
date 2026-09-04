-- Foundation migration.
-- Later milestones add identity, tenancy, and operational tables with RLS.

create extension if not exists pgcrypto;
