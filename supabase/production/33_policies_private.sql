revoke all on all tables in schema private from authenticated;
revoke all on all tables in schema private from anon;

comment on schema private is 'Sensitive MiniMRP data. Keep browser access blocked and use backend-only access patterns.';
