# Reigns fetch reads the People fetch's raw output

Fetch stages are otherwise independent, but the reigns query is parameterized on known person Q-IDs, so it reads the People fetch's raw output as its candidate ID list. This is a deliberate, narrow exception: it's reading IDs to build a query, not reshaping or merging data, so it doesn't turn Fetch into a transform step.
