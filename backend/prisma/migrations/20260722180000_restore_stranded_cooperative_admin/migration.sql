-- Data fix: a COOPERATIVE_ADMIN self-demoted to MEMBER via the members
-- role dropdown before the last-admin safeguard existed, stranding the
-- "Adamoda" cooperative with no one able to manage it. Restores that one
-- membership, scoped tightly by membership id + cooperative id + user
-- email so this can never touch any other row.
UPDATE "CooperativeMembership" AS m
SET role = 'COOPERATIVE_ADMIN'
FROM "User" AS u
WHERE m.id = 'cmrwb67is00082skkpmxsyiik'
  AND m."cooperativeId" = 'cmrwb67in00062skkjkkzf8az'
  AND m."userId" = u.id
  AND u.email = 'demo@ncms.test'
  AND m.role = 'MEMBER';
