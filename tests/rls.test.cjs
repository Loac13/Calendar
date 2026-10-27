const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Supabase policies isolate users and reject anonymous access in PostgreSQL',async()=>{
 const db=new PGlite();
 try {
  // Minimal Supabase auth contract. No production identities or network access.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
  await db.exec(fs.readFileSync('supabase/setup.sql','utf8'));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
    insert into public.calendar_snapshots(user_id,payload) values (auth.uid(),'{}');`);
  assert.equal((await db.query('select * from public.calendar_snapshots')).rows.length,1);
  await assert.rejects(db.exec(`insert into public.calendar_snapshots(user_id,payload) values ('22222222-2222-4222-8222-222222222222','{}')`),/row-level security/);
  await assert.rejects(db.exec(`update public.calendar_snapshots set user_id='22222222-2222-4222-8222-222222222222'`),/row-level security/);
  await db.exec(`set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'`);
  assert.equal((await db.query('select * from public.calendar_snapshots')).rows.length,0);
  assert.equal((await db.query(`update public.calendar_snapshots set version=2 returning user_id`)).rows.length,0);
  await db.exec(`insert into public.calendar_snapshots(user_id,payload) values (auth.uid(),'{}')`);
  assert.equal((await db.query('select * from public.calendar_snapshots')).rows.length,1);
  await assert.rejects(db.exec('delete from public.calendar_snapshots'),/permission denied/);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.exec('select * from public.calendar_snapshots'),/permission denied/);
  await assert.rejects(db.exec(`insert into public.calendar_snapshots(user_id,payload) values ('11111111-1111-4111-8111-111111111111','{}')`),/permission denied/);
 }finally{await db.close()}
});
