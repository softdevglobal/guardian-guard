
ALTER TABLE incidents DISABLE TRIGGER USER;
ALTER TABLE risks DISABLE TRIGGER USER;
ALTER TABLE complaints DISABLE TRIGGER USER;

UPDATE incidents SET participant_id = '0f85b45e-4002-42b6-9538-d7e3d7b82f9a', linked_staff_id = 'b9517915-cf6f-4d21-9212-f62fb9058715' WHERE id = 'a0000001-0001-0001-0001-000000000001';
UPDATE incidents SET participant_id = '3d8d6c62-98e5-4753-8831-de54db89feb1', linked_staff_id = 'b855e1af-c99b-4edc-ad00-92234c8460c1' WHERE id = 'a0000001-0001-0001-0001-000000000002';
UPDATE incidents SET participant_id = '92be441c-4c2f-489e-9ac1-eb5eb7df0673', linked_staff_id = 'b9517915-cf6f-4d21-9212-f62fb9058715' WHERE id = 'a0000001-0001-0001-0001-000000000003';
UPDATE incidents SET participant_id = 'f499fb88-8597-4871-88a8-f055dda1292c', linked_staff_id = '4dd96ab7-c6c1-49f0-b60e-8bea1f6ec2f5' WHERE id = 'a0000001-0001-0001-0001-000000000004';
UPDATE incidents SET participant_id = '6ba164c0-eeec-43b7-abde-4a7b6288b8b9', linked_staff_id = 'b855e1af-c99b-4edc-ad00-92234c8460c1' WHERE id = 'a0000001-0001-0001-0001-000000000005';
UPDATE incidents SET participant_id = 'e1f303b9-acb8-4595-9b00-51cac4bfadcc', linked_staff_id = 'b9517915-cf6f-4d21-9212-f62fb9058715' WHERE id = 'a0000001-0001-0001-0001-000000000006';
UPDATE incidents SET participant_id = '31fd1bfc-92c5-4d37-ab8f-d4ce9e5cf77d', linked_staff_id = '4dd96ab7-c6c1-49f0-b60e-8bea1f6ec2f5' WHERE id = 'a0000001-0001-0001-0001-000000000007';
UPDATE incidents SET participant_id = '46045b84-2b3d-451e-9e48-68a40c9923cb', linked_staff_id = 'b855e1af-c99b-4edc-ad00-92234c8460c1' WHERE id = 'a0000001-0001-0001-0001-000000000008';
UPDATE incidents SET participant_id = '7531bde8-d700-43a3-a419-f76b14e3906a', linked_staff_id = 'b9517915-cf6f-4d21-9212-f62fb9058715' WHERE id = 'a0000001-0001-0001-0001-000000000009';
UPDATE incidents SET participant_id = 'b9bed209-7861-4c4d-a9cd-e566081fa0fb', linked_staff_id = '4dd96ab7-c6c1-49f0-b60e-8bea1f6ec2f5' WHERE id = 'a0000001-0001-0001-0001-000000000010';

UPDATE complaints SET participant_id = '0f85b45e-4002-42b6-9538-d7e3d7b82f9a' WHERE id = 'c0000001-0001-0001-0001-000000000001';
UPDATE complaints SET participant_id = '3d8d6c62-98e5-4753-8831-de54db89feb1' WHERE id = 'c0000002-0001-0001-0001-000000000002';
UPDATE complaints SET participant_id = '92be441c-4c2f-489e-9ac1-eb5eb7df0673' WHERE id = 'c0000003-0001-0001-0001-000000000003';
UPDATE complaints SET participant_id = 'f499fb88-8597-4871-88a8-f055dda1292c' WHERE id = 'c0000004-0001-0001-0001-000000000004';
UPDATE complaints SET participant_id = '6ba164c0-eeec-43b7-abde-4a7b6288b8b9' WHERE id = 'c0000005-0001-0001-0001-000000000005';
UPDATE complaints SET participant_id = 'e1f303b9-acb8-4595-9b00-51cac4bfadcc' WHERE id = 'c0000006-0001-0001-0001-000000000006';
UPDATE complaints SET participant_id = '31fd1bfc-92c5-4d37-ab8f-d4ce9e5cf77d' WHERE id = 'c0000007-0001-0001-0001-000000000007';
UPDATE complaints SET participant_id = '46045b84-2b3d-451e-9e48-68a40c9923cb' WHERE id = 'c0000008-0001-0001-0001-000000000008';

UPDATE risks SET linked_participant_id = '92be441c-4c2f-489e-9ac1-eb5eb7df0673' WHERE id = 'd0000001-0001-0001-0001-000000000003' AND linked_participant_id IS NULL;
UPDATE risks SET linked_participant_id = 'f499fb88-8597-4871-88a8-f055dda1292c', linked_incident_id = 'a0000001-0001-0001-0001-000000000004' WHERE id = 'd0000001-0001-0001-0001-000000000004' AND linked_participant_id IS NULL;
UPDATE risks SET linked_participant_id = '6ba164c0-eeec-43b7-abde-4a7b6288b8b9' WHERE id = 'd0000001-0001-0001-0001-000000000005' AND linked_participant_id IS NULL;
UPDATE risks SET linked_participant_id = 'e1f303b9-acb8-4595-9b00-51cac4bfadcc', linked_incident_id = 'a0000001-0001-0001-0001-000000000006' WHERE id = 'd0000001-0001-0001-0001-000000000007' AND linked_participant_id IS NULL;
UPDATE risks SET linked_participant_id = '31fd1bfc-92c5-4d37-ab8f-d4ce9e5cf77d', linked_incident_id = 'a0000001-0001-0001-0001-000000000007' WHERE id = 'd0000001-0001-0001-0001-000000000008' AND linked_participant_id IS NULL;
UPDATE risks SET linked_participant_id = '46045b84-2b3d-451e-9e48-68a40c9923cb' WHERE id = 'd0000001-0001-0001-0001-000000000010' AND linked_participant_id IS NULL;

ALTER TABLE incidents ENABLE TRIGGER USER;
ALTER TABLE risks ENABLE TRIGGER USER;
ALTER TABLE complaints ENABLE TRIGGER USER;
