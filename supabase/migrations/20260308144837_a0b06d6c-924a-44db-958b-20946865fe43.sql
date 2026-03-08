-- Move student from duplicate assignment to the original one
UPDATE gcrp_assignment_students 
SET assignment_id = '1b98aa47-06d2-4896-b589-a305b5685c18'
WHERE assignment_id = '3569c77d-f9a7-4478-bde0-74006b27ee73';

-- Delete the duplicate assignment
DELETE FROM subject_teacher_assignments 
WHERE id = '3569c77d-f9a7-4478-bde0-74006b27ee73';