import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { supabase } from '../../utils/supabase';

export default function CoordenacaoScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { context } = useSubscription();
  const [members, setMembers] = useState<any[]>([]); const [sessions, setSessions] = useState<any[]>([]); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const allowed = ['owner','coordinator','supervisor'].includes(context?.membership?.role || '');
  const load = async () => {
    const [{ data: memberData }, { data: sessionData }] = await Promise.all([
      supabase.from('organization_members').select('id,user_id,role,status,joined_at').order('created_at'),
      supabase.from('active_sessions').select('id,user_id,device_name,platform,status,last_heartbeat_at').eq('status','active').order('last_heartbeat_at',{ ascending:false }),
    ]);
    setMembers(memberData || []); setSessions(sessionData || []);
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);
  const createInvite = async () => {
    setBusy(true); const { data, error } = await supabase.rpc('create_organization_invite', { p_role: 'agent', p_email: email.trim() || null, p_expires_in_hours: 72 }); setBusy(false);
    if (error || !data?.allowed) return Alert.alert('Convite não criado', error?.message || data?.reason || 'Verifique vagas e assinatura.');
    await Clipboard.setStringAsync(data.token); setEmail(''); Alert.alert('Convite criado', `Código ${data.token} copiado. Ele expira em 72 horas.`); load();
  };
  const endSession = (id: string) => Alert.alert('Encerrar sessão?', 'O aparelho perderá acesso ao validar a sessão.', [{ text:'Cancelar' }, { text:'Encerrar', style:'destructive', onPress: async () => { await supabase.rpc('end_active_session',{ p_session_id:id,p_reason:'municipal_coordinator' }); load(); } }]);
  if (!allowed) return <View style={[styles.center,{backgroundColor:theme.background}]}><Text style={{color:theme.text}}>Acesso restrito à coordenação.</Text></View>;
  return <View style={[styles.container,{backgroundColor:theme.background}]}><View style={[styles.header,{paddingTop:insets.top+10,borderBottomColor:theme.border}]}><TouchableOpacity onPress={()=>router.back()}><Feather name="arrow-left" size={22} color={theme.text}/></TouchableOpacity><Text style={[styles.title,{color:theme.text}]}>Coordenação municipal</Text></View><ScrollView contentContainerStyle={styles.content}>
    <Text style={[styles.section,{color:theme.text}]}>Novo convite de agente</Text><View style={styles.row}><TextInput value={email} onChangeText={setEmail} placeholder="E-mail (opcional)" placeholderTextColor={theme.muted} style={[styles.input,{color:theme.text,borderColor:theme.border,backgroundColor:theme.surface}]}/><TouchableOpacity disabled={busy} onPress={createInvite} style={[styles.button,{backgroundColor:theme.primary}]}><Feather name="user-plus" color="#fff" size={18}/></TouchableOpacity></View>
    <Text style={[styles.section,{color:theme.text}]}>Equipe ({members.length})</Text>{members.map(m=><View key={m.id} style={[styles.card,{backgroundColor:theme.surface,borderColor:theme.border}]}><Feather name="user" size={18} color={theme.primary}/><View><Text style={{color:theme.text,fontWeight:'700'}}>{m.role}</Text><Text style={{color:theme.textSecondary,fontSize:12}}>{m.status} · {m.user_id.slice(0,8)}</Text></View></View>)}
    <Text style={[styles.section,{color:theme.text}]}>Sessões ativas ({sessions.length})</Text>{sessions.map(s=><View key={s.id} style={[styles.card,{backgroundColor:theme.surface,borderColor:theme.border}]}><Feather name="smartphone" size={18} color={theme.primary}/><View style={{flex:1}}><Text style={{color:theme.text,fontWeight:'700'}}>{s.device_name || s.platform}</Text><Text style={{color:theme.textSecondary,fontSize:12}}>{new Date(s.last_heartbeat_at).toLocaleString('pt-BR')}</Text></View><TouchableOpacity onPress={()=>endSession(s.id)}><Feather name="log-out" color={theme.error} size={19}/></TouchableOpacity></View>)}
  </ScrollView></View>;
}
const styles=StyleSheet.create({container:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center'},header:{paddingHorizontal:20,paddingBottom:16,flexDirection:'row',alignItems:'center',gap:16,borderBottomWidth:1},title:{fontSize:21,fontWeight:'800'},content:{padding:20,paddingBottom:60},section:{fontSize:16,fontWeight:'800',marginTop:16,marginBottom:10},row:{flexDirection:'row',gap:10},input:{flex:1,height:50,borderWidth:1,borderRadius:12,paddingHorizontal:14},button:{width:50,height:50,borderRadius:12,alignItems:'center',justifyContent:'center'},card:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:12,borderWidth:1,marginBottom:8}});
