# DEADFACE CTF — Aurora Health: Veltrexa Data-Lock Tampering

**Category:** SQL / Database investigation  
**Analyst:** bratxer  
**Target:** https://aurora.dctf.io/  
**Database:** `aurora_trials`

## 1. Challenge

Find the subject whose primary efficacy result was modified after the Veltrexa study's official data-lock date. The result must have `measure = 'primary_efficacy_delta'`, and the lock date is recorded in the `studies` table.

Required flag format:

```text
deadface{subject_code}
```

## 2. Result

```text
deadface{VELT-0137}
```

The database returned exactly one matching result:

| Subject code | Result ID | Measure | Modified at | Data-lock date |
| --- | --- | --- | --- | --- |
| `VELT-0137` | `200058` | `primary_efficacy_delta` | `2025-12-06 23:14:00` | `2025-12-01` |

This result was modified after the study's recorded lock date, satisfying the challenge's condition. The flag was derived from live database output; it was not submitted to the challenge platform during this investigation.

## 3. Access the provided shell

The challenge URL serves a `ttyd` web terminal connected to a MySQL shell. The terminal presented an `aurora>` prompt, with MySQL Community Server version `8.0.46`.

Browser automation was unavailable during the investigation, so the same provided terminal was accessed through its WebSocket transport. The terminal client page exposed `/token` and `/ws`; the connection used the `tty` WebSocket subprotocol. This supplied the existing challenge shell without a separate database login or authentication bypass.

The SQL below can be entered directly into the challenge's browser terminal. Only database selection, schema inspection, and read-only queries were used.

## 4. Locate the trial database

An initial `SHOW TABLES;` returned:

```text
ERROR 1046 (3D000): No database selected
```

List the available databases:

```sql
SHOW DATABASES;
```

The output included:

```text
aurora_audit
aurora_ehr
aurora_pharmacy
aurora_trials
information_schema
performance_schema
```

Select the trial database and list its tables:

```sql
USE aurora_trials;
SHOW TABLES;
```

Returned tables:

```text
adverse_events
data_changes
results
sites
studies
subjects
```

`USE` selects the database for subsequent queries. It does not modify the stored records.

## 5. Inspect the schema and official lock date

```sql
DESCRIBE studies;
DESCRIBE results;
DESCRIBE subjects;
```

`DESCRIBE` shows column names, types, and key information. The relevant columns were:

| Table | Relevant columns | Purpose |
| --- | --- | --- |
| `studies` | `study_id`, `drug_name`, `data_lock_date` | Identify the study and its official lock date |
| `subjects` | `subject_id`, `study_id`, `subject_code` | Connect each subject to a study and recover the requested code |
| `results` | `result_id`, `subject_id`, `measure`, `modified_at` | Identify the efficacy result and when it was modified |

The `data_changes` schema was also inspected, but its records were not needed to answer this challenge.

Retrieve the Veltrexa study:

```sql
SELECT study_id, drug_name, data_lock_date
FROM studies
WHERE drug_name LIKE '%Veltrexa%';
```

Observed output:

```text
+----------+------------------------+----------------+
| study_id | drug_name              | data_lock_date |
+----------+------------------------+----------------+
|        1 | Veltrexa (velcoraxine)  | 2025-12-01     |
+----------+------------------------+----------------+
1 row in set
```

The wildcard match finds Veltrexa even though the stored name also contains its generic name, `velcoraxine`.

## 6. Find primary efficacy results changed after the lock

```sql
SELECT
    s.subject_code,
    r.result_id,
    r.measure,
    r.modified_at,
    st.data_lock_date
FROM results AS r
JOIN subjects AS s
    ON s.subject_id = r.subject_id
JOIN studies AS st
    ON st.study_id = s.study_id
WHERE st.drug_name LIKE '%Veltrexa%'
  AND r.measure = 'primary_efficacy_delta'
  AND r.modified_at > st.data_lock_date;
```

### How the query works

1. `FROM results AS r` starts with the trial result records. `r` is a short alias for the table.
2. The first `JOIN` connects a result to its subject using `subject_id`, making `subject_code` available.
3. The second `JOIN` connects that subject to the correct study using `study_id`, making the study's lock date available.
4. The drug-name condition limits the search to Veltrexa.
5. The measure condition selects only `primary_efficacy_delta` results.
6. The final comparison requires the modification timestamp to be later than the study's lock date.

The joins matter: each result must be compared with the lock date of its own study, rather than an unrelated study or a manually assumed date.

### Observed query result

```text
subject_code:   VELT-0137
result_id:      200058
measure:        primary_efficacy_delta
modified_at:   2025-12-06 23:14:00
data_lock_date: 2025-12-01

1 row in set
```

`modified_at` is a `DATETIME` column, while `data_lock_date` is a `DATE`. The query compares against the start of the lock date. If a task instead explicitly meant after the entire lock day, `DATE(r.modified_at) > st.data_lock_date` would express that interpretation. This matching record is on December 6, so that distinction does not affect its qualification.

## 7. Build the flag

Place the returned subject code inside the required wrapper:

```text
deadface{VELT-0137}
```

## 8. Evidence boundaries

The live query confirms that result `200058` belongs to subject `VELT-0137`, has the required measure, and has a modification timestamp later than the Veltrexa lock date. Exactly one row matched the query.

This establishes the condition requested by the CTF. The query alone does not identify who made the edit, the previous efficacy value, or the reason for the change. Those questions would require additional investigation of modification metadata and audit records.

No records were inserted, updated, or deleted. The terminal session was exited with `quit` after obtaining the result.
