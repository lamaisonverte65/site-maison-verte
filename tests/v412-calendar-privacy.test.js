import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/calendar.js';

function database() {
  const reads = [];
  const rows = {
    external_occupancies: [{source:'booking',external_uid:'SECRET-UID',start_date:'2027-01-01',end_date:'2027-01-04',is_current:true}],
    external_occupancy_conflict_runs: [],
    accounting_entries: [{source:'booking',metadata:{guest_name:'PRIVATE-NAME',external_calendar_uid:'SECRET-UID'}}],
    booking_requests: [], calendar_blocks: [],
    pricing_settings: {default_night_price:80}, season_prices: [], price_overrides: []
  };
  return {reads,from(table) { reads.push(table); const q = {select(){return q},eq(){return q},in(){return q},order(){return q},maybeSingle(){return q},then(resolve,reject){return Promise.resolve({data:rows[table],error:null}).then(resolve,reject)}}; return q; }};
}
test('public calendar never queries accounting or exposes private reservations', async () => {
  const db = database();
  const response = await handler({httpMethod:'GET'}, {}, {createClient:()=>db});
  assert.equal(response.statusCode,200);
  const body = JSON.parse(response.body);
  assert.deepEqual(body.unavailableDates,['2027-01-01','2027-01-02','2027-01-03']);
  assert.equal('externalReservations' in body,false);
  assert.equal(db.reads.includes('accounting_entries'),false);
  assert.doesNotMatch(response.body,/SECRET-UID|PRIVATE-NAME/);
});
test('public calendar fails closed when local occupancy cannot be read', async () => {
  const db=database(); const from=db.from;
  db.from=(table)=>table==='booking_requests'?{select(){return this},in(){return Promise.resolve({error:new Error('private database details')})}}:from(table);
  const response=await handler({httpMethod:'GET'}, {}, {createClient:()=>db});
  assert.equal(response.statusCode,500);
  assert.doesNotMatch(response.body,/private database details/);
});
test('admin calendar rejects missing credentials before reading occupancy', async () => {
  const admin=await import('../netlify/functions/admin-calendar.js');
  const db=database();
  const response=await admin.handler({httpMethod:'GET',headers:{}},{},{createClient:()=>db});
  assert.equal(response.statusCode,401);
  assert.deepEqual(db.reads,[]);
});

test('admin calendar returns enriched reservations only for an active authorized profile', async () => {
 const {handler:admin}=await import('../netlify/functions/admin-calendar.js');
 const {createAuthSupabase}=await import('./helpers/fakeSupabase.js');
 for(const role of ['owner','housekeeping','unknown']) {
  const db=database(); const dataFrom=db.from;
  const {client}=createAuthSupabase({authUser:{id:'user-1',email:'owner@example.test'},adminUser:{id:'profile-1',auth_user_id:'user-1',role,is_owner:role==='owner',is_active:true}});
  db.auth=client.auth;db.from=(table)=>table==='admin_users'?client.from(table):dataFrom(table);
  const response=await admin({httpMethod:'GET',headers:{authorization:'Bearer test-token'}},{},{createClient:()=>db});
  if(role==='unknown'){assert.equal(response.statusCode,403);assert.deepEqual(db.reads,[]);}
  else {assert.equal(response.statusCode,200);assert.equal(JSON.parse(response.body).externalReservations[0].guest_name,'PRIVATE-NAME');}
 }
});
test('admin calendar client sends the bearer token to the protected route',async()=>{
 const {loadExternalCalendarForAdmin}=await import('../src/components/admin/calendar/loadExternalCalendar.js');
 let request;
 await loadExternalCalendarForAdmin(async(url,options)=>{request={url,options};return {ok:true,json:async()=>({})}},'session-token');
 assert.equal(request.url,'/.netlify/functions/admin-calendar');
 assert.equal(request.options.headers.Authorization,'Bearer session-token');
 assert.equal(request.options.cache,'no-store');
});
