-- First, clean up any remaining duplicate roles by keeping only the first one found
DELETE FROM user_roles a USING (
    SELECT user_id, MIN(id::text) as min_id
    FROM user_roles
    GROUP BY user_id
    HAVING COUNT(*) > 1
) b
WHERE a.user_id = b.user_id AND a.id::text != b.min_id;

-- Add unique constraint on user_id to prevent duplicate roles
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);