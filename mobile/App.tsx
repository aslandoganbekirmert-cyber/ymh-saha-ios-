
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, ScrollView,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, StatusBar
} from 'react-native';
import * as Location from 'expo-location';
import { Camera, CameraType } from 'expo-camera'; // Expo Camera'nın doğru kullanımı
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

// BACKEND ADRESİ (IPA/APK İÇİN IP ZORUNLU)
const API_URL = 'http://172.20.10.3:3000/api/v1';

export default function App() {
  const [view, setView] = useState('auth'); // auth | dashboard | form | new-site
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // New Project Form
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteCoords, setNewSiteCoords] = useState(null);
  const [fetchedAddress, setFetchedAddress] = useState({ city: 'İzmir', district: 'Merkez' });

  // Transaction Form
  const [wbForm, setWbForm] = useState({
    plate: '', company: '', invoice_no: '', material: 'HAFRİYAT',
    qty: '', unit: 'Sefer', notes: '', image: null
  });

  const [showActionSheet, setShowActionSheet] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = Camera.useCameraPermissions();
  const cameraRef = useRef(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // --- API CALLS ---
  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        Alert.alert('Hata', 'Projeler yüklenemedi');
      }
    } catch (e) {
      Alert.alert('Bağlantı Hatası', 'Sunucuya ulaşılamıyor: ' + API_URL);
    } finally {
      setLoading(false);
    }
  };

  const createSite = async () => {
    if (!newSiteName) return Alert.alert('Uyarı', 'Proje adı giriniz');
    setLoading(true);
    try {
      const payload = {
        name: newSiteName,
        code: `PROJE-${Date.now().toString().slice(-4)}`,
        city: fetchedAddress.city,
        district: fetchedAddress.district,
        status: 'ACTIVE',
        gps_lat: newSiteCoords?.lat || 0,
        gps_lng: newSiteCoords?.lng || 0
      };

      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newP = await res.json();
        setProjects([...projects, newP]);
        setView('auth');
        setNewSiteName('');
        openDashboard(newP);
      } else {
        Alert.alert('Hata', 'Oluşturulamadı');
      }
    } catch { Alert.alert('Hata', 'Sunucu hatası'); }
    finally { setLoading(false); }
  };

  const openDashboard = async (p) => {
    setActiveProject(p);
    setView('dashboard');
    try {
      const res = await fetch(`${API_URL}/transactions?project_id=${p.id}`);
      if (res.ok) setTransactions(await res.json());
    } catch { }
  };

  const saveWaybill = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('project_id', activeProject.id);
      fd.append('plate_no', wbForm.plate || 'PLAKA YOK');
      fd.append('company', wbForm.company || '');
      fd.append('invoice_no', wbForm.invoice_no || '');
      fd.append('material', wbForm.material);
      fd.append('quantity', wbForm.qty || '0');
      fd.append('unit', wbForm.unit);
      fd.append('notes', wbForm.notes || '');

      if (wbForm.image) {
        // Native image upload logic
        const localUri = wbForm.image.uri;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        fd.append('file', { uri: localUri, name: filename, type });
      }

      // Konum ekle
      let location = await Location.getCurrentPositionAsync({});
      fd.append('gps_lat', String(location.coords.latitude));
      fd.append('gps_lng', String(location.coords.longitude));

      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        body: fd,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.ok) {
        const newTx = await res.json();
        setTransactions([newTx, ...transactions]);
        setView('dashboard');
        setWbForm({
          plate: '', company: '', invoice_no: '', material: 'HAFRİYAT',
          qty: '', unit: 'Sefer', notes: '', image: null
        });
        Alert.alert('Başarılı', 'Kayıt eklendi');
      } else {
        Alert.alert('Hata', 'Kayıt başarısız');
      }
    } catch (e) { Alert.alert('Hata', 'Sunucu hatası: ' + e.message); }
    finally { setLoading(false); }
  };

  // --- NATIVE FEATURES ---
  const fetchLocation = async () => {
    setNewSiteLocation('Konum alınıyor...');
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setNewSiteLocation('İzin reddedildi');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setNewSiteCoords({ lat: location.coords.latitude, lng: location.coords.longitude });

    // Reverse Geocoding
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.coords.latitude}&lon=${location.coords.longitude}`);
      const data = await res.json();
      setNewSiteLocation(data.display_name);

      const addr = data.address;
      setFetchedAddress({
        city: addr.province || addr.city || 'İzmir',
        district: addr.suburb || addr.town || 'Merkez'
      });
    } catch {
      setNewSiteLocation(`${location.coords.latitude}, ${location.coords.longitude}`);
    }
  };

  const takeConfigPhoto = async () => {
    if (!cameraPermission || !cameraPermission.granted) {
      requestCameraPermission();
      return;
    }
    setCameraVisible(true);
  };

  const snapPhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setWbForm({ ...wbForm, image: photo });
      setCameraVisible(false);
      setView('form');
      setShowActionSheet(false);
    }
  };

  // --- RENDER ---
  if (cameraVisible) return (
    <View style={{ flex: 1 }}>
      <Camera style={{ flex: 1 }} type={CameraType.back} ref={cameraRef}>
        <View style={{ flex: 1, backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'center', marginBottom: 40 }}>
          <TouchableOpacity onPress={() => setCameraVisible(false)} style={{ position: 'absolute', top: 50, left: 20 }}>
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={snapPhoto} style={{ alignSelf: 'flex-end', alignItems: 'center' }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', borderWidth: 5, borderColor: '#ccc' }} />
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* AUTH VIEW */}
      {view === 'auth' && (
        <View style={styles.authContainer}>
          <Image source={require('./assets/icon.png')} style={{ width: 100, height: 100, marginBottom: 20 }} resizeMode="contain" />
          <Text style={styles.title}>YMH Operasyon</Text>
          <Text style={styles.subtitle}>Devam etmek için proje seçin</Text>

          {loading ? <ActivityIndicator size="large" color="#FFD600" /> : (
            <ScrollView style={{ width: '100%', marginTop: 20 }}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} style={styles.projectCard} onPress={() => openDashboard(p)}>
                  <View style={styles.iconBox}><Ionicons name="business" size={24} color="#333" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{p.name}</Text>
                    <Text style={styles.cardSubtitle}>{p.city} / {p.district}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.addButton} onPress={() => setView('new-site')}>
                <Ionicons name="add" size={24} color="#FFD600" />
                <Text style={styles.addButtonText}>Yeni Proje Başlat</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Image source={require('./assets/icon.png')} style={{ width: 30, height: 30 }} />
            <Text style={styles.headerTitle}>{activeProject?.name}</Text>
            <TouchableOpacity onPress={() => setView('auth')}><Ionicons name="log-out-outline" size={24} color="#333" /></TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Sefer</Text>
                <Text style={styles.statValue}>{transactions.length}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#18181B' }]}>
                <Text style={[styles.statLabel, { color: '#ccc' }]}>Hafriyat</Text>
                <Text style={[styles.statValue, { color: '#fff' }]}>{transactions.reduce((a, b) => a + Number(b.quantity || 0), 0)}</Text>
              </View>
            </View>

            {transactions.map(t => (
              <View key={t.id} style={styles.txCard}>
                <View style={[styles.iconBox, { backgroundColor: '#f0f0f0' }]}>
                  <Ionicons name="truck" size={20} color="#555" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t.plate_no}</Text>
                  <Text style={styles.cardSubtitle}>{t.material} • {t.company}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.quantity} {t.unit}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* FAB */}
          <TouchableOpacity style={styles.fab} onPress={() => setShowActionSheet(true)}>
            <Ionicons name="add" size={32} color="#18181B" />
          </TouchableOpacity>

          {/* ACTION SHEET */}
          <Modal transparent visible={showActionSheet} animationType="slide">
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
              <TouchableOpacity activeOpacity={1} style={styles.actionSheet}>
                <TouchableOpacity style={styles.sheetItem} onPress={takeConfigPhoto}>
                  <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="scan" size={24} color="#D97706" />
                  </View>
                  <View>
                    <Text style={styles.sheetTitle}>Fiş Tara / OCR</Text>
                    <Text style={styles.sheetDesc}>Kamera ile otomatik oku</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.sheetItem} onPress={() => { setShowActionSheet(false); setView('form'); }}>
                  <View style={[styles.iconBox, { backgroundColor: '#F4F4F5' }]}>
                    <Ionicons name="create" size={24} color="#52525B" />
                  </View>
                  <View>
                    <Text style={styles.sheetTitle}>Manuel Giriş</Text>
                    <Text style={styles.sheetDesc}>Elle veri doldur</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      {/* NEW SITE & FORM VIEWS (SIMILAR LOGIC...) */}
      {(view === 'new-site' || view === 'form') && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setView('dashboard')}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            <Text style={styles.headerTitle}>{view === 'form' ? 'Yeni İrsaliye' : 'Yeni Proje'}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.content}>
            {view === 'new-site' ? (
              <>
                <Text style={styles.label}>PROJE ADI</Text>
                <TextInput style={styles.input} placeholder="Örn: Merkez Depo" value={newSiteName} onChangeText={setNewSiteName} />

                <Text style={styles.label}>KONUM</Text>
                <View>
                  <TextInput style={[styles.input, { height: 80 }]} multiline value={newSiteLocation} placeholder="Adres..." />
                  <TouchableOpacity style={{ position: 'absolute', right: 10, top: 10 }} onPress={fetchLocation}>
                    <Ionicons name="location" size={24} color="#10B981" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btnPrimary} onPress={createSite}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Oluştur</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* FORM FIELDS */}
                {wbForm.image && (
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Image source={{ uri: wbForm.image.uri }} style={{ width: 100, height: 100, borderRadius: 10 }} />
                    <Text style={{ color: 'red', marginTop: 5 }} onPress={() => setWbForm({ ...wbForm, image: null })}>Sil</Text>
                  </View>
                )}

                <Text style={styles.label}>PLAKA</Text>
                <TextInput style={styles.input} value={wbForm.plate} onChangeText={t => setWbForm({ ...wbForm, plate: t.toUpperCase() })} placeholder="34 ABC 123" />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>MİKTAR</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={wbForm.qty} onChangeText={t => setWbForm({ ...wbForm, qty: t })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>BİRİM</Text>
                    <TextInput style={styles.input} value={wbForm.unit} editable={false} />
                  </View>
                </View>

                <TouchableOpacity style={styles.btnPrimary} onPress={saveWaybill}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Kaydet</Text>}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  authContainer: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  projectCard: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderRadius: 15, marginBottom: 10, alignItems: 'center', gap: 15, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { fontSize: 13, color: '#888' },
  iconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  addButton: { flexDirection: 'row', padding: 20, backgroundColor: '#18181B', borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 },
  addButtonText: { color: '#FFD600', fontWeight: 'bold', fontSize: 16 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 15 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#666' },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 5 },
  txCard: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderRadius: 15, marginBottom: 10, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#eee' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FEF3C7', borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#D97706' },
  fab: { position: 'absolute', bottom: 30, padding: 20, alignSelf: 'center', backgroundColor: '#FFD600', borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 40 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sheetTitle: { fontSize: 16, fontWeight: 'bold' },
  sheetDesc: { fontSize: 12, color: '#888' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5, marginTop: 15 },
  input: { height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 15, backgroundColor: '#f9f9f9', fontSize: 16 },
  btnPrimary: { height: 55, backgroundColor: '#18181B', borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
