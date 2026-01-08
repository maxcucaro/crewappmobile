-- Query per analizzare la tabella registration_requests

-- 1. Struttura della tabella
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'registration_requests' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Constraints e indici
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.is_deferrable,
    tc.initially_deferred
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'registration_requests' 
    AND tc.table_schema = 'public';

-- 3. Indici
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'registration_requests' 
    AND schemaname = 'public';

-- 4. RLS Policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'registration_requests' 
    AND schemaname = 'public';

-- 5. Foreign Keys
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'registration_requests';

-- 6. Verifica se auth_user_id ha constraint UNIQUE
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'registration_requests'::regclass
    AND contype IN ('u', 'p'); -- unique o primary key

-- 7. Conta record per verificare dati
SELECT 
    COUNT(*) as total_records,
    COUNT(auth_user_id) as records_with_auth_user_id,
    COUNT(DISTINCT auth_user_id) as unique_auth_user_ids,
    COUNT(*) - COUNT(DISTINCT auth_user_id) as potential_duplicates
FROM registration_requests;

-- 8. Verifica duplicati auth_user_id
SELECT 
    auth_user_id,
    COUNT(*) as count,
    array_agg(id) as registration_ids,
    array_agg(full_name) as names
FROM registration_requests 
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING COUNT(*) > 1;