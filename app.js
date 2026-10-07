/*
  ARI-CPA7
  Configure SUPABASE_URL and SUPABASE_ANON_KEY before deployment.
  This frontend expects the SQL schema in schema.sql.
*/
const SUPABASE_URL = "https://wwaottspnimufvmogjyd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Js37MZq3SV1u9L1A7csf7Q_zW-ywRMl";

const DEMO_ADMIN = { cpf: '82011435153', password: '725120', name: 'Administrador ARI-CPA7' };
const DEMO_OPERATOR = { cpf: '11144477735', password: '123456', name: 'Operador de Campo - TESTE' };
const demoAccounts = window.ariDemoAccounts || [
  {id:'demo-admin', cpf:DEMO_ADMIN.cpf, password:DEMO_ADMIN.password, name:DEMO_ADMIN.name, role:'admin', status:'ativo'},
  {id:'demo-operator', cpf:DEMO_OPERATOR.cpf, password:DEMO_OPERATOR.password, name:DEMO_OPERATOR.name, role:'operator', status:'ativo'}
];
window.ariDemoAccounts = demoAccounts;
const RECOVERY_EMAIL = 'cpa7.fb@gmail.com';
const MS_CITIES = ['Água Clara','Alcinópolis','Amambai','Anastácio','Anaurilândia','Angélica','Antônio João','Aparecida do Taboado','Aquidauana','Aral Moreira','Bandeirantes','Bataguassu','Batayporã','Bela Vista','Bodoquena','Bonito','Brasilândia','Caarapó','Camapuã','Campo Grande','Caracol','Cassilândia','Chapadão do Sul','Corguinho','Coronel Sapucaia','Corumbá','Costa Rica','Coxim','Deodápolis','Dois Irmãos do Buriti','Douradina','Dourados','Eldorado','Fátima do Sul','Figueirão','Glória de Dourados','Guia Lopes da Laguna','Iguatemi','Inocência','Itaporã','Itaquiraí','Ivinhema','Japorã','Jaraguari','Jardim','Jateí','Juti','Ladário','Laguna Carapã','Maracaju','Miranda','Mundo Novo','Naviraí','Nioaque','Nova Alvorada do Sul','Nova Andradina','Novo Horizonte do Sul','Paraíso das Águas','Paranaíba','Paranhos','Pedro Gomes','Ponta Porã','Porto Murtinho','Ribas do Rio Pardo','Rio Brilhante','Rio Negro','Rio Verde de Mato Grosso','Rochedo','Santa Rita do Pardo','São Gabriel do Oeste','Selvíria','Sete Quedas','Sidrolândia','Sonora','Tacuru','Taquarussu','Terenos','Três Lagoas','Vicentina'];
window.ariDemoVehicles = window.ariDemoVehicles || [];
window.ariDemoActivities = window.ariDemoActivities || [];

const configured = !SUPABASE_URL.includes("COLOQUE_AQUI") && !SUPABASE_ANON_KEY.includes("COLOQUE_AQUI");
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = id => document.getElementById(id);
const loginView = $("loginView"), operatorView = $("operatorView"), adminView = $("adminView");
let currentProfile = null;

function onlyDigits(v){ return (v || "").replace(/\D/g,""); }
function cpfValid(cpf){
  cpf=onlyDigits(cpf); if(cpf.length!==11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum=0; for(let i=0;i<9;i++) sum += +cpf[i]*(10-i);
  let d1=(sum*10)%11; if(d1===10)d1=0; if(d1!==+cpf[9])return false;
  sum=0; for(let i=0;i<10;i++) sum += +cpf[i]*(11-i);
  let d2=(sum*10)%11; if(d2===10)d2=0; return d2===+cpf[10];
}
async function emailForCpf(cpf){
  const normalized = onlyDigits(cpf);

  // Administrador já confirmado no Supabase.
  // Fazemos esta associação diretamente para não depender do retorno
  // do RPC durante a recuperação da senha.
  if (normalized === "82011435153") return "03galassi@gmail.com";

  if(!sb) return null;

  try {
    const { data, error } = await sb.rpc("get_login_email", { p_cpf: normalized });
    console.log("ARI-CPA7 RPC", { cpf: normalized, data, error });
    if (error) throw error;
    if (typeof data === "string" && data.trim()) return data.trim();
    if (Array.isArray(data) && data.length) {
      const value = data[0]?.auth_email || data[0]?.email || data[0];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch (err) {
    console.error("ARI-CPA7 RPC exception", err);
  }
  return null;
}
async function roleForCpf(cpf){
  const normalized=onlyDigits(cpf);
  if(normalized === "82011435153") return "admin";
  if(!sb) return null;
  try{
    const {data,error}=await sb.rpc("get_login_role",{p_cpf:normalized});
    if(error) throw error;
    if(typeof data === "string") return data.trim();
    if(Array.isArray(data) && data.length){
      const value=data[0]?.role || data[0];
      return typeof value === "string" ? value.trim() : null;
    }
  }catch(err){
    console.error("ARI-CPA7: erro ao identificar perfil",err);
  }
  return null;
}

function showMsg(el,text){el.textContent=text;el.classList.remove("hidden");}
function hideMsg(el){el.classList.add("hidden");}

// Recuperação de senha disponível para Administradores e Chefes de Equipe.
const forgotBtn=$("forgotBtn");
if(forgotBtn) forgotBtn.classList.remove("hidden");

$("cpf").addEventListener("input",e=>{
  let v=onlyDigits(e.target.value).slice(0,11);
  e.target.value=v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
});

$("password").addEventListener("input",e=>e.target.value=onlyDigits(e.target.value).slice(0,6));

$("loginForm").addEventListener("submit", async e=>{
  e.preventDefault(); hideMsg($("loginMsg"));
  const cpf=onlyDigits($("cpf").value), password=$("password").value;
  if(!cpfValid(cpf)){showMsg($("loginMsg"),"Informe um CPF válido.");return}
  if(password.length!==6){showMsg($("loginMsg"),"A senha deve possuir exatamente 6 dígitos.");return}
  if(!sb){
    const account=demoAccounts.find(a=>a.cpf===cpf && a.password===password && a.status==='ativo');
    if(account){
      currentProfile={id:account.id,name:account.name,cpf:account.cpf,role:account.role,status:account.status};
      loginView.classList.add('hidden');
      if(account.role==='admin'){
        adminView.classList.remove('hidden');
        demoHistory.push({date:new Date().toLocaleString('pt-BR'),user:cpf,action:'Login administrativo',detail:'Acesso ao painel'});
        renderAdminHomeActivities();
      }else{
        operatorView.classList.remove('hidden');
        $("operatorName").textContent=`Usuário: ${account.name} | CPF: ${account.cpf}`;
        loadDemoOperatorActivitiesFor(account.cpf);
      }
      return;
    }
    showMsg($("loginMsg"),"CPF ou senha inválidos.");
    return;
  }
  const loginEmail = await emailForCpf(cpf);
  if(!loginEmail){showMsg($("loginMsg"),"CPF ou senha inválidos.");return}
  const {data,error}=await sb.auth.signInWithPassword({email:loginEmail,password});
  if(error){showMsg($("loginMsg"),"CPF ou senha inválidos.");return}
  await loadProfile(data.user.id);
});

async function loadProfile(uid){
  const {data,error}=await sb.from("profiles").select("*").eq("id",uid).single();
  if(error || !data || data.status!=="ativo"){await sb.auth.signOut();showMsg($("loginMsg"),"Usuário sem autorização de acesso.");return}
  currentProfile=data; loginView.classList.add("hidden");
  if(data.role==="admin"){adminView.classList.remove("hidden");renderAdminHomeActivities()}else{operatorView.classList.remove("hidden");$("operatorName").textContent=data.name;await loadActivities()}
}

$("forgotBtn").addEventListener("click",async()=>{
  const cpf=onlyDigits($("cpf").value);
  if(!cpfValid(cpf)){showMsg($("loginMsg"),"Digite seu CPF válido para iniciar a recuperação.");return}
  if(!sb){
    showMsg($("loginMsg"),`A recuperação de senha estará disponível quando o sistema estiver conectado ao Supabase.`);
    return;
  }
  const loginEmail = await emailForCpf(cpf);
  if(!loginEmail){showMsg($("loginMsg"),"Não foi possível localizar o e-mail deste CPF. Se o cadastro no Supabase estiver correto, atualize a página e tente novamente.");return}
  const redirectTo = `${location.origin}${location.pathname}`;
  const {error}=await sb.auth.resetPasswordForEmail(loginEmail,{redirectTo});
  if(error){
    console.error("ARI-CPA7: erro ao solicitar recuperação", error);
    showMsg($("loginMsg"),`Não foi possível enviar a recuperação: ${error.message || "verifique a configuração do Supabase."}`);
    return;
  }
  showMsg($("loginMsg"),`Link de recuperação enviado para ${loginEmail}. Verifique seu e-mail.`);
});

function showResetView(){
  loginView.classList.add("hidden");
  operatorView.classList.add("hidden");
  adminView.classList.add("hidden");
  $("resetView").classList.remove("hidden");
  hideMsg($("resetMsg"));
}

$("newPassword").addEventListener("input",e=>e.target.value=onlyDigits(e.target.value).slice(0,6));
$("confirmPassword").addEventListener("input",e=>e.target.value=onlyDigits(e.target.value).slice(0,6));

$("resetForm").addEventListener("submit",async e=>{
  e.preventDefault();
  hideMsg($("resetMsg"));
  const password=$("newPassword").value;
  const confirm=$("confirmPassword").value;
  if(password.length!==6){showMsg($("resetMsg"),"A senha deve possuir exatamente 6 dígitos.");return}
  if(password!==confirm){showMsg($("resetMsg"),"As senhas não coincidem.");return}
  if(!sb){showMsg($("resetMsg"),"Sistema de autenticação indisponível.");return}
  const {error}=await sb.auth.updateUser({password});
  if(error){
    console.error("ARI-CPA7: erro ao alterar senha", error);
    showMsg($("resetMsg"),`Não foi possível alterar a senha: ${error.message || "tente novamente."}`);
    return;
  }
  await sb.auth.signOut();
  $("resetForm").reset();
  $("resetView").classList.add("hidden");
  loginView.classList.remove("hidden");
  showMsg($("loginMsg"),"Senha alterada com sucesso. Agora entre com seu CPF e a nova senha.");
});

$("cancelReset").onclick=async()=>{
  if(sb) await sb.auth.signOut();
  $("resetView").classList.add("hidden");
  loginView.classList.remove("hidden");
};

if(sb){
  sb.auth.onAuthStateChange(async(event, session)=>{
    if(event === "PASSWORD_RECOVERY"){
      setTimeout(showResetView, 0);
    }
  });
}

async function logout(){
  if(sb) await sb.auth.signOut();
  currentProfile=null; operatorView.classList.add("hidden");adminView.classList.add("hidden");loginView.classList.remove("hidden");
}
$("logoutOperator").onclick=logout;$("logoutAdmin").onclick=logout;

async function loadActivities(){
  if(!sb || !currentProfile) return;

  const {data,error}=await sb.from("activities")
    .select("*")
    .eq("owner_id",currentProfile.id)
    .order("saida_data",{ascending:false})
    .order("saida_hora",{ascending:false});

  // A interface antiga usava #activityList; a interface atual usa #myActivities.
  // Aceitamos os dois para evitar que uma versão do HTML quebre o carregamento.
  const box=$("activityList") || $("myActivities");
  if(!box){
    console.warn("ARI-CPA7: nenhum contêiner de atividades encontrado no HTML.");
    return;
  }

  if(error){
    console.error("ARI-CPA7: erro ao carregar atividades",error);
    box.innerHTML='<div class="empty">Não foi possível carregar suas atividades.</div>';
    return;
  }

  const rows=data||[];
  const fieldCount=$("fieldCount");
  const fieldKm=$("fieldKm");
  if(fieldCount) fieldCount.textContent=rows.length;
  const totalKm=rows.reduce((s,a)=>{
    const x=Number(a.km_inicial), y=Number(a.km_final);
    return s+(Number.isFinite(x)&&Number.isFinite(y)&&y>=x?y-x:0);
  },0);
  if(fieldKm) fieldKm.textContent=totalKm;

  if(!rows.length){
    box.innerHTML='<div class="empty">Nenhuma atividade lançada. Toque em “+ Nova atividade” para começar.</div>';
    return;
  }

  box.innerHTML=rows.map(a=>{
    const complete=!!(a.retorno_data&&a.retorno_hora&&a.km_final!==null&&a.km_final!==undefined);
    return `<div class="item">
      <div class="item-head">
        <strong>${a.saida_data||"—"} — ${a.viatura||"—"}</strong>
        <button class="secondary real-edit" data-id="${a.id}">Editar</button>
      </div>
      <div>${a.saida_local||"—"} → ${a.destino||"—"}</div>
      <small>Saída: ${a.saida_hora||"—"} | KM inicial: ${a.km_inicial??"—"}</small>
      <div class="edit-note ${complete?'complete':'pending'}">${complete?'Retorno registrado':'Aguardando retorno'}</div>
    </div>`;
  }).join("");

  box.querySelectorAll(".real-edit").forEach(btn=>{
    const a=rows.find(x=>String(x.id)===String(btn.dataset.id));
    if(a) btn.onclick=()=>editActivity(a);
  });
}

function editActivity(a){
  $("editorTitle").textContent="Editar atividade";$("activityEditor").classList.remove("hidden");
  const map={activityId:a.id,saidaLocal:a.saida_local,saidaData:a.saida_data,saidaHora:a.saida_hora,viatura:a.viatura,kmInicial:a.km_inicial,destino:a.destino,descricao:a.descricao,informacao:a.informacao,retornoLocal:a.retorno_local,kmFinal:a.km_final,retornoData:a.retorno_data,retornoHora:a.retorno_hora};
  Object.entries(map).forEach(([k,v])=>$(k).value=v??"");
  window.scrollTo({top:$("activityEditor").offsetTop-10,behavior:"smooth"});
}

function fillFieldSelects(){
  const origem=$("saidaLocal"), destino=$("destino"), retorno=$("retornoLocal"), viatura=$("viatura");
  const cityOptions = placeholder => '<option value="">'+placeholder+'</option>'+MS_CITIES.map(c=>`<option value="${c}">${c}</option>`).join("");
  if(origem && origem.tagName==="INPUT"){
    const s=document.createElement("select");s.id="saidaLocal";s.required=true;
    s.innerHTML=cityOptions("Selecione a cidade de saída");
    origem.replaceWith(s);
  }
  if(destino && destino.tagName==="INPUT"){
    const s=document.createElement("select");s.id="destino";s.required=true;
    s.innerHTML=cityOptions("Selecione a cidade de destino");
    destino.replaceWith(s);
  }
  if(retorno && retorno.tagName==="INPUT"){
    const s=document.createElement("select");s.id="retornoLocal";
    s.innerHTML=cityOptions("Selecione a cidade de retorno");
    retorno.replaceWith(s);
  }
  // A viatura é sugerida pelo cadastro do administrador, mas continua editável no lançamento do relatório.
  if(viatura && viatura.tagName==="INPUT"){
    viatura.setAttribute("list","viaturasDisponiveis");
    viatura.placeholder="Selecione ou digite/edite a viatura";
    let list=$("viaturasDisponiveis");
    if(!list){
      list=document.createElement("datalist"); list.id="viaturasDisponiveis";
      document.body.appendChild(list);
    }
    viatura.required=true;
  }
  refreshVehicleSuggestions();
}
function refreshVehicleSuggestions(){
  const list=$("viaturasDisponiveis"); if(!list)return;
  list.innerHTML=window.ariDemoVehicles.filter(v=>v.status==="ativa").map(v=>`<option value="${v.plate}">${v.desc||""}</option>`).join("");
}

function refreshVehicleSelect(){
  refreshVehicleSuggestions();
}
fillFieldSelects();
$("newActivity").onclick=()=>{
  $("editorTitle").textContent="Nova atividade";$("activityForm").reset();$("activityId").value="";
  const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  $("saidaData").value=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  $("saidaHora").value=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $("activityEditor").classList.remove("hidden");
};
$("cancelEdit").onclick=()=>$("activityEditor").classList.add("hidden");
$("cancelEdit2").onclick=()=>$("activityEditor").classList.add("hidden");

$("activityForm").addEventListener("submit",async e=>{
  e.preventDefault();
  hideMsg($("activityMsg"));

  const id = $("activityId").value;
  const payload = {
    owner_id: currentProfile?.id || null,
    saida_local: $("saidaLocal").value,
    saida_data: $("saidaData").value,
    saida_hora: $("saidaHora").value,
    viatura: $("viatura").value.trim(),
    km_inicial: Number($("kmInicial").value),
    destino: $("destino").value,
    descricao: $("descricao").value.trim(),
    informacao: $("informacao").value.trim(),
    retorno_local: $("retornoLocal").value || null,
    km_final: $("kmFinal").value ? Number($("kmFinal").value) : null,
    retorno_data: $("retornoData").value || null,
    retorno_hora: $("retornoHora").value || null
  };

  if(!payload.saida_local || !payload.saida_data || !payload.saida_hora || !payload.viatura ||
     !Number.isFinite(payload.km_inicial) || !payload.destino || !payload.descricao || !payload.informacao){
    showMsg($("activityMsg"),"Preencha todos os campos obrigatórios.");
    return;
  }
  if(payload.km_final !== null && payload.km_final < payload.km_inicial){
    showMsg($("activityMsg"),"O KM final não pode ser menor que o KM inicial.");
    return;
  }

  // Modo de demonstração: salva no navegador e fica disponível para o administrador.
  if(!sb && currentProfile?.id === "demo-operator"){
    const demoPayload = {
      id: id || crypto.randomUUID(),
      owner: currentProfile.cpf,
      ownerName: currentProfile.name,
      saidaLocal: payload.saida_local,
      data: payload.saida_data,
      hora: payload.saida_hora,
      viatura: payload.viatura,
      kmInicial: String(payload.km_inicial),
      destino: payload.destino,
      descricao: payload.descricao,
      informacao: payload.informacao,
      retornoLocal: payload.retorno_local || "",
      kmFinal: payload.km_final === null ? "" : String(payload.km_final),
      retornoData: payload.retorno_data || "",
      retornoHora: payload.retorno_hora || ""
    };
    const pos = window.ariDemoActivities.findIndex(x=>x.id===id);
    if(pos >= 0) window.ariDemoActivities[pos] = demoPayload;
    else window.ariDemoActivities.push(demoPayload);

    demoHistory.push({
      date:new Date().toLocaleString("pt-BR"),
      user:DEMO_OPERATOR.cpf,
      action:id ? "Edição de atividade" : "Novo lançamento",
      detail:`${demoPayload.viatura} / ${demoPayload.destino}`
    });

    $("activityEditor").classList.add("hidden");
    $("activityForm").reset();
    $("activityId").value="";
    loadDemoOperatorActivities();
    showMsg($("activityMsg"), id ? "Atividade atualizada com sucesso." : "Atividade salva com sucesso.");
    setTimeout(()=>hideMsg($("activityMsg")),2500);
    return;
  }

  // Produção/Supabase.
  if(!sb){
    showMsg($("activityMsg"),"O sistema não está conectado ao banco de dados.");
    return;
  }

  let result;
  if(!currentProfile?.id){
    showMsg($("activityMsg"),"Usuário não identificado. Faça login novamente.");
    return;
  }

  if(id){
    // O Chefe de Equipe só pode editar uma atividade que pertença a ele.
    result = await sb.from("activities")
      .update(payload)
      .eq("id",id)
      .eq("owner_id",currentProfile.id);
  }else{
    // Vincula explicitamente a atividade ao perfil/usuário autenticado.
    result = await sb.from("activities").insert({
      ...payload,
      owner_id: currentProfile.id
    });
  }

  if(result.error){
    console.error("ARI-CPA7: erro ao salvar atividade", result.error);
    showMsg($("activityMsg"),`Não foi possível salvar: ${result.error.message || "verifique os dados e a autorização."}`);
    return;
  }

  $("activityEditor").classList.add("hidden");
  $("activityForm").reset();
  $("activityId").value="";
  await loadActivities();
  showMsg($("activityMsg"), id ? "Atividade atualizada com sucesso." : "Atividade salva com sucesso.");
  setTimeout(()=>hideMsg($("activityMsg")),2500);
});

/* ===== Modo de campo para teste local ===== */
function loadDemoOperatorActivities(){ loadDemoOperatorActivitiesFor(currentProfile?.cpf || DEMO_OPERATOR.cpf); }
function loadDemoOperatorActivitiesFor(cpf){
  const mine=window.ariDemoActivities.filter(a=>a.owner===cpf);
  $("fieldCount").textContent=mine.length;
  const totalKm=mine.reduce((s,a)=>{
    const x=Number(a.kmInicial),y=Number(a.kmFinal);
    return s+(Number.isFinite(x)&&Number.isFinite(y)&&y>=x?y-x:0);
  },0);
  $("fieldKm").textContent=totalKm;
  const box=$("myActivities");
  box.innerHTML=mine.length ? mine.slice().reverse().map(a=>{
    const complete=a.retornoData&&a.retornoHora&&a.kmFinal!==""&&a.kmFinal!=null;
    return `<div class="item">
      <div class="item-head">
        <strong>${a.data||"—"} — ${a.viatura||"—"}</strong>
        <button class="secondary demo-edit" data-id="${a.id}">Editar</button>
      </div>
      <div>${a.saidaLocal||"—"} → ${a.destino||"—"}</div>
      <small>Saída: ${a.hora||"—"} | KM inicial: ${a.kmInicial||"—"}</small>
      <div class="edit-note ${complete?'complete':'pending'}">${complete?'Retorno registrado':'Aguardando retorno'}</div>
    </div>`;
  }).join("") :
  '<div class="empty">Nenhuma atividade lançada. Toque em “+ Nova atividade” para começar.</div>';
  box.querySelectorAll(".demo-edit").forEach(b=>b.onclick=()=>editDemoActivity(b.dataset.id));
}

function editDemoActivity(id){
  const a=window.ariDemoActivities.find(x=>x.id===id); if(!a)return;
  hideMsg($("activityMsg"));
  $("editorTitle").textContent="Editar atividade";
  $("activityEditor").classList.remove("hidden");
  const map={activityId:a.id,saidaLocal:a.saidaLocal,saidaData:a.data,saidaHora:a.hora,viatura:a.viatura,kmInicial:a.kmInicial,destino:a.destino,descricao:a.descricao,informacao:a.informacao,retornoLocal:a.retornoLocal,kmFinal:a.kmFinal,retornoData:a.retornoData,retornoHora:a.retornoHora};
  Object.entries(map).forEach(([k,v])=>$(k).value=v??"");
  window.scrollTo({top:$("activityEditor").offsetTop-10,behavior:"smooth"});
}
function renderDemoVehicles(){
  const box=$("vehiclesContent");
  box.innerHTML=window.ariDemoVehicles.length?`<table class="admin-table"><thead><tr><th>Viatura</th><th>Descrição</th><th>Status</th><th>Ação</th></tr></thead><tbody>${
    window.ariDemoVehicles.map(v=>`<tr><td>${v.plate}</td><td>${v.desc||"—"}</td><td class="status ${v.status}">${v.status}</td><td><button class="secondary vehicle-toggle" data-id="${v.id}">${v.status==="ativa"?"Desativar":"Ativar"}</button></td></tr>`).join("")
  }</tbody></table>`:'<div class="empty">Nenhuma viatura cadastrada.</div>';
  box.querySelectorAll(".vehicle-toggle").forEach(b=>b.onclick=()=>{
    const v=window.ariDemoVehicles.find(x=>x.id===b.dataset.id); if(!v)return;
    v.status=v.status==="ativa"?"inativa":"ativa"; renderDemoVehicles(); refreshVehicleSelect();
  });
}
$("vehicleForm").addEventListener("submit",e=>{
  e.preventDefault();
  const plate=$("vehiclePlate").value.trim().toUpperCase();
  if(!plate){return}
  if(window.ariDemoVehicles.some(v=>v.plate===plate)){alert("Esta viatura já está cadastrada.");return}
  window.ariDemoVehicles.push({id:crypto.randomUUID(),plate,desc:$("vehicleDesc").value.trim(),status:$("vehicleStatus").value});
  $("vehicleForm").reset(); renderDemoVehicles(); refreshVehicleSelect();
});

function escHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function openActivityPdf(a){
  if(!window.jspdf){alert("Não foi possível carregar o gerador de PDF. Verifique sua conexão com a internet.");return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const margin=18, pageW=210, maxW=pageW-margin*2;
  let y=20;
  const fmtDate=(v)=>v?String(v):"—";
  const fmtHour=(v)=>{ if(!v) return "—"; const s=String(v).slice(0,5); return s ? `${s}h` : "—"; };
  const outDate=a.data||a.saidaData||a.saida_data||"—";
  const outHour=a.hora||a.saidaHora||a.saida_hora||"—";
  const retDate=a.retornoData||a.retorno_data||"—";
  const retHour=a.retornoHora||a.retorno_hora||"—";
  const operator=a.ownerName||a.operador||a.owner||"—";
  const cpf=a.ownerCpf||a.cpf||"—";
  const origem=a.saidaLocal||a.saida_local||"—";
  const destino=a.destino||"—";
  const viatura=a.viatura||"—";
  const kmI=a.kmInicial??a.km_inicial??"—";
  const kmF=a.kmFinal??a.km_final??"—";
  const ni=Number(kmI), nf=Number(kmF);
  const kmPerc=Number.isFinite(ni)&&Number.isFinite(nf)&&nf>=ni ? nf-ni : "—";
  const retorno=a.retornoLocal||a.retorno_local||"—";
  const descricao=a.descricao||"—";
  const informacao=a.informacao||a.informacao_obtida||"—";

  doc.setFont("helvetica","bold"); doc.setFontSize(15);
  doc.text("RELATÓRIO DE ATIVIDADE — ARI-CPA7",pageW/2,y,{align:"center"}); y+=13;
  doc.setFontSize(11);

  const inlineLine=(parts)=>{
    if(y>280){doc.addPage();y=20;}
    let x=margin;
    parts.forEach(([label,value],i)=>{
      if(i){ const sep="  -  "; doc.setFont("helvetica","normal"); doc.text(sep,x,y); x+=doc.getTextWidth(sep); }
      const l=label+": "; doc.setFont("helvetica","bold"); doc.text(l,x,y); x+=doc.getTextWidth(l);
      doc.setFont("helvetica","normal");
      const available=pageW-margin-x;
      const wrapped=doc.splitTextToSize(String(value??"—"),Math.max(30,available));
      doc.text(wrapped,x,y);
      x += Math.min(doc.getTextWidth(wrapped[0]||""),available);
    });
    y+=8;
  };
  const paragraph=(label,value)=>{
    if(y>270){doc.addPage();y=20;}
    doc.setFont("helvetica","bold"); doc.text(label+":",margin,y); y+=6;
    doc.setFont("helvetica","normal");
    const lines=doc.splitTextToSize(String(value??"—"),maxW);
    for(const line of lines){
      if(y>282){doc.addPage();y=20;}
      doc.text(line,margin,y); y+=5;
    }
    y+=4;
  };

  inlineLine([["Agente de Inteligência",operator],["CPF",cpf]]);
  inlineLine([["Cidade de Origem",`${origem} - MS`],["Cidade de Destino",`${destino} - MS`],["Viatura",viatura]]);
  inlineLine([["Data de saída",fmtDate(outDate)],["Hora de Saída",fmtHour(outHour)]]);
  inlineLine([["KM inicial",kmI],["KM final",kmF],["KM percorridos",kmPerc]]);
  paragraph("Descrição da atividade",descricao);
  inlineLine([["Data de retorno",fmtDate(retDate)],["Hora de retorno",fmtHour(retHour)],["Local de retorno",`${retorno} - MS`]]);
  paragraph("Informação obtida",informacao);

  doc.setFontSize(8); doc.setFont("helvetica","italic");
  doc.text(`Documento gerado pelo ARI-CPA7 em ${new Date().toLocaleString("pt-BR")}`,margin,285);
  const blob=doc.output("blob");
  const url=URL.createObjectURL(blob);
  window.open(url,"_blank");
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

/* ===== Painel administrativo ===== */
const demoUsers = demoAccounts.map(u=>({
  id:u.id,
  name:u.name,
  cpf:u.cpf,
  role:u.role==='admin'?'Administrador':'Chefe de Equipe',
  status:u.status==='ativo'?'Ativo':'Bloqueado'
}));
let demoHistory = [
  {date:new Date().toLocaleString("pt-BR"), user:"82011435153", action:"Login administrativo", detail:"Acesso ao painel"}
];

function showAdminPanel(id){
  $("adminHome").classList.add("hidden");
  document.querySelectorAll(".adminPanel").forEach(p=>p.classList.add("hidden"));
  $(id).classList.remove("hidden");
}
function hideAdminPanels(){
  document.querySelectorAll(".adminPanel").forEach(p=>p.classList.add("hidden"));
  $("adminHome").classList.remove("hidden");
}

/* O administrador agora é identificado pelo perfil real do Supabase.
   A regra antiga que exigia id === "demo-admin" foi removida. */
function isAdminUser(){
  return !!currentProfile &&
         currentProfile.role === "admin" &&
         currentProfile.status === "ativo";
}

async function renderDemoUsers(){
  let users = [];

  if(sb){
    const {data,error} = await sb
      .from("profiles")
      .select("id,name,cpf,role,status,auth_email")
      .order("name",{ascending:true});

    if(error){
      console.error("ARI-CPA7: erro ao carregar usuários", error);
      $("usersContent").innerHTML =
        '<div class="empty">Não foi possível carregar os usuários do Supabase.</div>';
      return;
    }
    users = data || [];
  }else{
    users = demoAccounts;
  }

  const rows = users.map(u=>`<tr>
    <td>${escHtml(u.name)}</td>
    <td>${escHtml(u.cpf)}</td>
    <td>${escHtml(u.auth_email || "—")}</td>
    <td>${u.role==='admin'?'Administrador':'Chefe de Equipe'}</td>
    <td class="status ${u.status==='ativo'?'ativo':'bloqueado'}">${u.status==='ativo'?'Ativo':'Bloqueado'}</td>
    <td class="actions-cell">
      <button class="secondary user-edit" data-id="${escHtml(u.id)}">Editar</button>
      ${!sb ? `<button class="danger user-delete" data-id="${escHtml(u.id)}">Excluir</button>` : ""}
    </td>
  </tr>`).join("");

  $("usersContent").innerHTML = `
    <form id="userForm" class="grid admin-user-form">
      <input type="hidden" id="editingUserId" value="">
      <div><label>Nome completo</label><input id="newUserName" required></div>
      <div><label>CPF</label><input id="newUserCpf" inputmode="numeric" maxlength="14" required placeholder="000.000.000-00"></div>
      <div><label>E-mail</label><input id="newUserEmail" type="email" autocomplete="email" required placeholder="usuario@exemplo.com"></div>
      <div>
        <label>Senha</label>
        <input id="newUserPassword" type="password" inputmode="numeric" maxlength="6" placeholder="6 dígitos">
        <small class="muted">Na edição de usuário real, a senha não é alterada por esta tela.</small>
      </div>
      <div><label>Perfil</label><select id="newUserRole"><option value="operator">Chefe de Equipe</option><option value="admin">Administrador</option></select></div>
      <div class="actions full">
        <button id="userSubmit" class="primary" type="submit">Cadastrar usuário</button>
        <button id="userCancelEdit" class="secondary hidden" type="button">Cancelar edição</button>
      </div>
    </form>
    <p id="userMsg" class="msg hidden"></p>
    <h3>Usuários cadastrados</h3>
    <div class="table-scroll"><table class="admin-table"><thead><tr><th>Nome</th><th>CPF</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  const cpfInput=$("newUserCpf");
  cpfInput.addEventListener('input',e=>{
    let v=onlyDigits(e.target.value).slice(0,11);
    e.target.value=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  });
  $("newUserPassword").addEventListener('input',e=>{
    e.target.value=onlyDigits(e.target.value).slice(0,6);
  });

  $("userForm").addEventListener('submit',async e=>{
    e.preventDefault();

    if(!isAdminUser()){
      showMsg($("userMsg"),"Somente um administrador ativo pode cadastrar e editar usuários.");
      return;
    }

    const editingId=$("editingUserId").value;
    const name=$("newUserName").value.trim();
    const cpf=onlyDigits(cpfInput.value);
    const email=$("newUserEmail").value.trim().toLowerCase();
    const password=$("newUserPassword").value;
    const role=$("newUserRole").value;

    if(!name){showMsg($("userMsg"),'Informe o nome.');return;}
    if(!cpfValid(cpf)){showMsg($("userMsg"),'Informe um CPF válido.');return;}
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showMsg($("userMsg"),'Informe um e-mail válido.');return;}
    if(!editingId && password.length!==6){showMsg($("userMsg"),'A senha inicial deve possuir exatamente 6 dígitos.');return;}

    if(sb){
      const duplicate = users.some(u=>u.cpf===cpf && u.id!==editingId);
      if(duplicate){showMsg($("userMsg"),'Este CPF já está cadastrado.');return;}
      const duplicateEmail = users.some(u=>String(u.auth_email||'').toLowerCase()===email && u.id!==editingId);
      if(duplicateEmail){showMsg($("userMsg"),'Este e-mail já está cadastrado.');return;}

      const action = editingId ? "update" : "create";
      const body = {action, name, cpf, email, role};
      if(editingId) body.user_id=editingId;
      if(password) body.password=password;

      const {data,error}=await sb.functions.invoke("admin-users",{body});
      if(error){
        console.error("ARI-CPA7: erro na função admin-users",error,data);
        const detail=data?.error || data?.message || error.message || "verifique a função admin-users.";
        showMsg($("userMsg"),`Não foi possível salvar o usuário: ${detail}`);
        return;
      }
      if(data?.error){showMsg($("userMsg"),`Não foi possível salvar o usuário: ${data.error}`);return;}

      showMsg($("userMsg"),editingId?'Usuário atualizado com sucesso.':'Usuário cadastrado com sucesso.');
      await renderDemoUsers();
      return;
    }

    /* Modo demonstração */
    if(password.length!==6){
      showMsg($("userMsg"),'A senha deve possuir exatamente 6 dígitos.');
      return;
    }

    const duplicate=demoAccounts.some(u=>u.cpf===cpf && u.id!==editingId);
    if(duplicate){
      showMsg($("userMsg"),'Este CPF já está cadastrado.');
      return;
    }

    if(editingId){
      const account=demoAccounts.find(u=>u.id===editingId);
      if(!account){showMsg($("userMsg"),'Usuário não encontrado.');return;}
      account.name=name;
      account.cpf=cpf;
      account.password=password;
      account.auth_email=email;
      account.role=role;
      demoHistory.push({
        date:new Date().toLocaleString('pt-BR'),
        user:currentProfile.cpf,
        action:'Edição de usuário',
        detail:`${name} / ${cpf} / ${role==='admin'?'Administrador':'Chefe de Equipe'}`
      });
      await renderDemoUsers();
      showMsg($("userMsg"),'Usuário atualizado com sucesso.');
    }else{
      const account={id:'demo-'+crypto.randomUUID(),cpf,password,name,role,status:'ativo',auth_email:email};
      demoAccounts.push(account);
      demoUsers.push({
        id:account.id,
        name,
        cpf,
        role:role==='admin'?'Administrador':'Chefe de Equipe',
        status:'Ativo'
      });
      demoHistory.push({
        date:new Date().toLocaleString('pt-BR'),
        user:currentProfile.cpf,
        action:'Cadastro de usuário',
        detail:`${name} / ${cpf} / ${role==='admin'?'Administrador':'Chefe de Equipe'}`
      });
      await renderDemoUsers();
      showMsg($("userMsg"),'Usuário cadastrado com sucesso.');
    }
  });

  $("userCancelEdit").onclick=()=>renderDemoUsers();

  document.querySelectorAll('.user-edit').forEach(btn=>btn.onclick=async()=>{
    let account;

    if(sb){
      const {data,error}=await sb
        .from("profiles")
        .select("id,name,cpf,role,status,auth_email")
        .eq("id",btn.dataset.id)
        .single();

      if(error || !data){
        showMsg($("userMsg"),"Usuário não encontrado.");
        return;
      }
      account=data;
    }else{
      account=demoAccounts.find(u=>u.id===btn.dataset.id);
      if(!account)return;
    }

    $("editingUserId").value=account.id;
    $("newUserName").value=account.name || "";
    $("newUserCpf").value=onlyDigits(account.cpf || "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    $("newUserEmail").value=account.auth_email || "";
    $("newUserPassword").value=sb ? "" : (account.password || "");
    $("newUserRole").value=account.role || "operator";
    $("userSubmit").textContent='Salvar alterações';
    $("userCancelEdit").classList.remove('hidden');
    window.scrollTo({top:$('usersPanel').offsetTop-10,behavior:'smooth'});
  });

  document.querySelectorAll('.user-delete').forEach(btn=>btn.onclick=()=>{
    if(!isAdminUser())return;
    const account=demoAccounts.find(u=>u.id===btn.dataset.id);
    if(!account)return;
    if(!confirm(`Excluir o usuário ${account.name}?\n\nEssa ação não poderá ser desfeita.`))return;

    const idx=demoAccounts.findIndex(u=>u.id===account.id);
    if(idx>=0)demoAccounts.splice(idx,1);

    const idx2=demoUsers.findIndex(u=>u.id===account.id);
    if(idx2>=0)demoUsers.splice(idx2,1);

    demoHistory.push({
      date:new Date().toLocaleString('pt-BR'),
      user:currentProfile.cpf,
      action:'Exclusão de usuário',
      detail:`${account.name} / ${account.cpf}`
    });

    renderDemoUsers();
    showMsg($("userMsg"),'Usuário excluído com sucesso.');
  });
}
async function renderAllActivities(){
  const q=($("activitySearch")?.value||"").toLowerCase().trim();
  let rows=[];

  // Versão conectada: o administrador consulta todos os relatórios lançados pela equipe.
  if(sb){
    const {data,error}=await sb
      .from("activities")
      .select("*, profiles(name, cpf)")
      .order("saida_data",{ascending:false})
      .order("saida_hora",{ascending:false});
    if(error){
      $("allActivitiesContent").innerHTML='<div class="empty">Não foi possível carregar os relatórios da equipe.</div>';
      return;
    }
    rows=(data||[]).map(a=>({
      ...a,
      ownerName:a.profiles?.name||a.owner_id||"—",
      ownerCpf:a.profiles?.cpf||"—",
      data:a.saida_data,
      hora:a.saida_hora,
      saidaLocal:a.saida_local,
      kmInicial:a.km_inicial,
      kmFinal:a.km_final,
      retornoLocal:a.retorno_local,
      retornoData:a.retorno_data,
      retornoHora:a.retorno_hora
    }));
  }else{
    rows=[...window.ariDemoActivities]
      .sort((a,b)=>`${b.data||""} ${b.hora||""}`.localeCompare(`${a.data||""} ${a.hora||""}`));
  }

  rows=rows.filter(a=>{
    const hay=[a.ownerName,a.owner,a.ownerCpf,a.viatura,a.destino,a.saidaLocal,a.retornoLocal,a.data,a.hora,a.descricao,a.informacao].join(" ").toLowerCase();
    return !q || hay.includes(q);
  });

  if(!rows.length){
    $("allActivitiesContent").innerHTML='<div class="empty">Nenhum relatório lançado pela equipe de campo.</div>';
    return;
  }

  $("allActivitiesContent").innerHTML=`<div class="report-count"><strong>${rows.length}</strong> relatório(s) lançado(s) pela equipe de campo, em ordem de data.</div>
  <div class="table-scroll"><table class="admin-table"><thead><tr>
    <th>Data/hora</th><th>Equipe / CPF</th><th>Saída</th><th>Destino</th><th>Viatura</th><th>KM</th><th>Retorno</th><th>Descrição</th>
  </tr></thead><tbody>${rows.map(a=>`<tr>
    <td>${a.data?new Date(`${a.data}T${a.hora||"00:00"}`).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—"}</td>
    <td>${a.ownerName||a.owner||"—"}<br><small>${a.ownerCpf||""}</small></td>
    <td>${a.saidaLocal||"—"}</td>
    <td>${a.destino||"—"}</td>
    <td><strong>${a.viatura||"—"}</strong></td>
    <td>${a.kmInicial??"—"} → ${a.kmFinal??"—"}</td>
    <td>${a.retornoLocal||"—"}${a.retornoData?`<br><small>${a.retornoData} ${a.retornoHora||""}</small>`:""}</td>
    <td>${a.descricao||"—"}</td>
  </tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll("#allActivitiesContent tbody tr").forEach((tr,i)=>{tr.style.cursor="pointer";tr.title="Clique para abrir o relatório em PDF";tr.addEventListener("click",()=>openActivityPdf(rows[i]));});
}
async function renderAdminHomeActivities(){
  let rows=[];
  if(sb){
    const {data,error}=await sb.from("activities")
      .select("*, profiles(name, cpf)")
      .order("saida_data",{ascending:false})
      .order("saida_hora",{ascending:false});
    if(error){$("adminHomeActivities").innerHTML='<div class="empty">Não foi possível carregar os relatórios.</div>';return;}
    rows=(data||[]).map(a=>({...a,ownerName:a.profiles?.name||"—",ownerCpf:a.profiles?.cpf||"—"}));
  }else{
    rows=[...window.ariDemoActivities].sort((a,b)=>`${b.data||""} ${b.hora||""}`.localeCompare(`${a.data||""} ${a.hora||""}`));
  }
  if(!rows.length){$("adminHomeActivities").innerHTML='<div class="empty">Nenhum relatório lançado pela equipe de campo.</div>';return;}
  $("adminHomeActivities").innerHTML=`<div class="report-count"><strong>${rows.length}</strong> relatório(s) encontrado(s).</div><div class="table-scroll"><table class="admin-table"><thead><tr><th>Data/hora</th><th>Equipe</th><th>Saída</th><th>Destino</th><th>Viatura</th><th>KM</th><th>Retorno</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${a.saida_data||a.data||"—"} ${a.saida_hora||a.hora||""}</td><td>${a.ownerName||a.owner||"—"}<br><small>${a.ownerCpf||a.owner||""}</small></td><td>${a.saida_local||a.saidaLocal||"—"}</td><td>${a.destino||"—"}</td><td><strong>${a.viatura||"—"}</strong></td><td>${a.km_inicial??a.kmInicial??"—"} → ${a.km_final??a.kmFinal??"—"}</td><td>${a.retorno_local||a.retornoLocal||"—"}</td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll("#adminHomeActivities tbody tr").forEach((tr,i)=>{tr.style.cursor="pointer";tr.title="Clique para abrir o relatório em PDF";tr.addEventListener("click",()=>openActivityPdf(rows[i]));});
}
function renderHistory(){
  $("historyContent").innerHTML=`<table class="admin-table"><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${
    demoHistory.map(h=>`<tr><td>${h.date}</td><td>${h.user}</td><td>${h.action}</td><td>${h.detail}</td></tr>`).join("")
  }</tbody></table>`;
}
async function renderMonthlyReport(){
  const box=$("reportResult");
  if(!box) return;
  box.innerHTML='<div class="empty">Carregando relatório mensal...</div>';

  let rows=[];
  if(sb){
    const {data,error}=await sb
      .from("activities")
      .select("id,owner_id,saida_data,saida_hora,viatura,km_inicial,km_final,profiles(name,cpf)")
      .order("saida_data",{ascending:false})
      .order("saida_hora",{ascending:false});
    if(error){
      console.error("ARI-CPA7: erro no relatório mensal",error);
      box.innerHTML=`<div class="empty">Não foi possível carregar o relatório mensal.<br><small>${escHtml(error.message||"Erro de autorização")}</small></div>`;
      return;
    }
    rows=(data||[]).map(a=>({
      ...a,
      ownerName:a.profiles?.name||a.owner_id||"—",
      ownerCpf:a.profiles?.cpf||"—"
    }));
  }else{
    rows=[...window.ariDemoActivities].map(a=>({
      ...a,ownerName:a.ownerName||a.owner||"—",ownerCpf:a.ownerCpf||a.owner||"—",
      saida_data:a.data,saida_hora:a.hora,km_inicial:a.kmInicial,km_final:a.kmFinal
    }));
  }

  if(!rows.length){
    box.innerHTML='<div class="empty">Nenhum lançamento registrado.</div>';
    return;
  }

  const months={};
  for(const a of rows){
    const month=String(a.saida_data||"").slice(0,7)||"Sem data";
    if(!months[month]) months[month]={actions:0,km:0,chiefs:{}};
    const m=months[month];
    const owner=a.owner_id||a.ownerCpf||a.ownerName||"sem-identificação";
    if(!m.chiefs[owner]) m.chiefs[owner]={name:a.ownerName||"—",cpf:a.ownerCpf||"—",actions:0,km:0};
    const c=m.chiefs[owner];
    const kmI=Number(a.km_inicial), kmF=Number(a.km_final);
    const km=Number.isFinite(kmI)&&Number.isFinite(kmF)&&kmF>=kmI ? kmF-kmI : 0;
    m.actions++; m.km+=km; c.actions++; c.km+=km;
  }

  const monthKeys=Object.keys(months).sort().reverse();
  const monthName=k=>{
    if(!/^\d{4}-\d{2}$/.test(k)) return k;
    const [y,m]=k.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  };

  box.innerHTML=monthKeys.map(k=>{
    const m=months[k];
    const chiefs=Object.values(m.chiefs).sort((a,b)=>b.actions-a.actions||b.km-a.km||a.name.localeCompare(b.name));
    return `<section class="item monthly-report-block">
      <div class="item-head"><strong style="text-transform:capitalize">${escHtml(monthName(k))}</strong><strong>${m.actions} ações | ${m.km} KM</strong></div>
      <div class="table-scroll"><table class="admin-table"><thead><tr><th>Chefe de Equipe</th><th>CPF</th><th>Ações</th><th>KM</th></tr></thead><tbody>
      ${chiefs.map(c=>`<tr><td>${escHtml(c.name)}</td><td>${escHtml(c.cpf)}</td><td>${c.actions}</td><td>${c.km}</td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
  }).join("");

  const printBtn=$("printReport");
  if(printBtn) printBtn.disabled=false;
}

async function printMonthlyReport(){
  await renderMonthlyReport();
  window.print();
}

function generateDemoReport(){ return renderMonthlyReport(); }

function bindOptional(id,event,handler){
  const el=$(id); if(el) el.addEventListener(event,handler);
}

document.querySelectorAll(".adminBtn").forEach(btn=>btn.addEventListener("click",async()=>{
  showAdminPanel(btn.dataset.panel);
  if(btn.dataset.panel==="usersPanel") await renderDemoUsers();
  if(btn.dataset.panel==="activitiesPanel") await renderAllActivities();
  if(btn.dataset.panel==="historyPanel") renderHistory();
  if(btn.dataset.panel==="vehiclesPanel") renderDemoVehicles();
  if(btn.dataset.panel==="reportsPanel") await renderMonthlyReport();
}));
document.querySelectorAll(".backAdmin").forEach(btn=>btn.addEventListener("click",hideAdminPanels));
bindOptional("activitySearchBtn","click",renderAllActivities);
bindOptional("generateReport","click",renderMonthlyReport);
bindOptional("printReport","click",printMonthlyReport);
