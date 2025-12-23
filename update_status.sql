UPDATE clinics 
SET status = 'pending_activation' 
WHERE email IN ('theboysofficialone@gmail.com', 'mani@test.com', 'test@test.com') 
  AND status != 'active';
