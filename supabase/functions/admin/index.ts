import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const baseHeaders={'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{status,headers:{...baseHeaders,'Access-Control-Allow-Origin':origin,'Content-Type':'application/json','Cache-Control':'no-store'}});

serve(async req=>{
  const origin=req.headers.get('origin')||'*';
  if(req.method==='OPTIONS')return new Response('ok',{headers:{...baseHeaders,'Access-Control-Allow-Origin':origin}});
  try{
    const url=Deno.env.get('SUPABASE_URL')!;
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth=req.headers.get('Authorization')||'';
    if(!auth.startsWith('Bearer '))return json({code:'UNAUTHORIZED'},401,origin);
    const authClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError}=await authClient.auth.getUser();
    if(userError||!user)return json({code:'UNAUTHORIZED'},401,origin);
    const db=createClient(url,service);
    const {data:admin}=await db.from('admin_users').select('user_id,display_name').eq('user_id',user.id).maybeSingle();
    if(!admin)return json({code:'FORBIDDEN'},403,origin);
    const requestUrl=new URL(req.url);
    const campaign='JLPT_SPIN_2026';
    if(req.method==='GET'){
      const view=requestUrl.searchParams.get('view')||'dashboard';
      if(view==='dashboard'){
        const {data,error}=await db.rpc('admin_dashboard',{p_campaign:campaign});
        if(error)throw error;return json(data,200,origin);
      }
      if(view==='spins'){
        const {data,error}=await db.rpc('admin_list_spins',{p_campaign:campaign,p_search:(requestUrl.searchParams.get('search')||'').slice(0,80),p_page:Number(requestUrl.searchParams.get('page')||1),p_page_size:25});
        if(error)throw error;return json(data,200,origin);
      }
      return json({code:'INVALID_VIEW'},400,origin);
    }
    if(req.method==='POST'){
      const body=await req.json();
      if(body.action!=='adjust_inventory')return json({code:'INVALID_ACTION'},400,origin);
      const {data,error}=await db.rpc('admin_adjust_inventory',{p_campaign:campaign,p_prize_code:String(body.prize_code||''),p_delta:Number(body.delta),p_reason:String(body.reason||'').slice(0,300),p_admin_user:user.id});
      if(error){const known=['INVALID_DELTA','REASON_REQUIRED','PRIZE_NOT_FOUND','INSUFFICIENT_AVAILABLE_INVENTORY'].find(x=>error.message?.includes(x));return json({code:known||'ADJUSTMENT_FAILED'},known?409:500,origin)}
      return json(data,200,origin);
    }
    return json({code:'METHOD_NOT_ALLOWED'},405,origin);
  }catch(error){console.error(error);return json({code:'ADMIN_API_FAILED'},500,origin)}
});
