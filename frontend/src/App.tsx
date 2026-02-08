import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import {
    MapPin,
    Plus,
    Camera as CameraIcon,
    Edit3,
    X,
    ChevronRight,
    Calendar,
    Image as ImageIcon,
    CheckCircle,
    Loader,
    Navigation,
    Truck,
    Package,
    FileText,
    Hash,
    Scale,
    Wifi,
    WifiOff,
    ServerCrash,
    Settings,
    Save,
    Briefcase
} from 'lucide-react';

/* --- TİPLER --- */
interface Waybill {
    id: string;
    projectId: string;
    projectName: string;
    date: string;
    plateNo: string;
    material: string;
    quantity: number;
    unit: string;
    supplier: string;
    waybillNo: string;
    imageUrl?: string;
    isManual: boolean;
    synced: boolean;
}

interface Project {
    id: string;
    name: string;
    location: string;
    color: string;
    coords: { lat: number; lng: number };
}

// Varsayılan Projeler
const DEFAULT_PROJECTS: Project[] = [
    { id: 'evka5', name: 'Evka-5 Şantiyesi', location: 'Çiğli, İzmir', color: '#FFD600', coords: { lat: 38.4895, lng: 27.0699 } },
    { id: 'karsiyaka', name: 'Bahçelievler', location: 'Karşıyaka', color: '#00E676', coords: { lat: 38.4622, lng: 27.1147 } }
];

const MATERIALS = [
    'Mil Kum', 'Bypass', 'Filler', 'Bims', 'Parke', 'Beton', 'Diğer'
];

const UNITS = ['Ton', 'm3', 'Adet', 'Sefer', 'kg', 'Torba'];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/* --- ANA UYGULAMA --- */
function App() {
    // State Tanımları (Önce waybills'i tanımlıyorum, garanti olsun)
    const [waybills, setWaybills] = useState<Waybill[]>([]);
    const [screen, setScreen] = useState<'intro' | 'project-select' | 'create-project' | 'dashboard' | 'settings' | 'stats'>('intro');
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);

    // UI State
    const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [showManualForm, setShowManualForm] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Network & Server State
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
    const [serverUrl, setServerUrl] = useState<string>('http://localhost:3000');

    // Detaylı Form Verisi
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        plateNo: '',
        material: '',
        customMaterial: '',
        quantity: '',
        unit: 'Ton',
        supplier: '',
        waybillNo: '',
        image: null as string | null
    });

    // Yeni Proje Formu
    const [newProject, setNewProject] = useState({ name: '', location: '' });

    /* 1. BAŞLANGIÇ */
    useEffect(() => {
        const initApp = async () => {
            // A) Sunucu Ayarını Yükle
            const { value: savedUrl } = await Preferences.get({ key: 'server_url' });
            const activeUrl = savedUrl || 'http://localhost:3000';
            setServerUrl(activeUrl);

            // B) Network Dinleyicisi
            Network.addListener('networkStatusChange', status => {
                setIsOnline(status.connected);
                if (status.connected) {
                    syncPendingData(activeUrl);
                }
            });
            const status = await Network.getStatus();
            setIsOnline(status.connected);

            // C) Yerel verileri yukle
            loadLocalData(activeUrl);

            // D) Projeleri Yükle
            loadProjects(activeUrl);

            // E) Konum Check
            checkLocationForProject(projects);
        };
        initApp();
    }, []);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 3500);
    };

    /* 2. PROJE YÖNETİMİ */
    const loadProjects = async (baseUrl: string) => {
        if (!baseUrl) return;
        try {
            let url = baseUrl;
            if (!url.startsWith('http')) url = `http://${url}`;
            if (!url.includes('/api/v1/projects')) url = `${url}/api/v1/projects`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const mappedProjects: Project[] = data.map((p: any) => ({
                    id: p.id,
                    name: p.name || 'İsimsiz Proje',
                    location: (p.district && p.city) ? `${p.district}, ${p.city}` : 'Konum Belirtilmemiş',
                    color: '#FFD600',
                    coords: { lat: Number(p.gps_lat) || 0, lng: Number(p.gps_lng) || 0 }
                }));

                if (mappedProjects.length > 0) {
                    setProjects(mappedProjects);
                    checkLocationForProject(mappedProjects);
                }
            }
        } catch (e) {
            console.log('Projeler yüklenemedi, varsayılanlar kullanılıyor.');
        }
    };

    /* KONUM YARDIMCISI */
    const getCurrentPositionSafe = async () => {
        try {
            // 1. İzin Kontrolü
            const perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
                const req = await Geolocation.requestPermissions();
                if (req.location !== 'granted') throw new Error('Konum izni verilmedi');
            }

            // 2. Konum Al (Capacitor)
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
            return position;
        } catch (e) {
            console.warn('Capacitor Geolocation Failed, trying Web API', e);
            // 3. Yedek (Browser API)
            return new Promise<any>((resolve, reject) => {
                if (!navigator.geolocation) return reject('Geolocation not supported');
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve(pos),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }
    };

    const checkLocationForProject = async (projectList: Project[]) => {
        try {
            const position = await getCurrentPositionSafe();
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            console.log('User Location:', userLat, userLng);

            let nearest: Project | null = null;
            let minDistance = 1000;

            projectList.forEach(project => {
                if (project.coords.lat && project.coords.lng) {
                    const dist = calculateDistance(userLat, userLng, project.coords.lat, project.coords.lng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearest = project;
                    }
                }
            });

            setTimeout(() => {
                if (nearest && minDistance < 1.5) {
                    setActiveProject(nearest);
                    setScreen('dashboard');
                    showToast(`📍 Konum: ${nearest.name}`, 'info');
                } else {
                    // Yakında proje yoksa listeye at ama hata verme
                    // setScreen('project-select'); // Bu satırı kaldırdım, kullanıcı seçsin
                }
            }, 1000);
        } catch (e) {
            console.error('Konum alınamadı:', e);
            // Sessizce geç, kullanıcı manuel seçsin
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.name) { showToast('Proje adı giriniz', 'error'); return; }

        setProcessing(true);
        try {
            // Konum Al (Güvenli Mod)
            let lat = 0, lng = 0;
            try {
                const position = await getCurrentPositionSafe();
                lat = position.coords.latitude;
                lng = position.coords.longitude;
            } catch (locErr) {
                console.error('Konum alınamadı, 0,0 kullanılıyor', locErr);
                showToast('⚠️ Konum alınamadı, varsayılan (0,0) kullanılıyor.', 'info');
                // Devam et, engelleme
            }

            // Backend'in Beklediği Format (DTO Uyumlu)
            const locationParts = newProject.location.split(',');
            const district = locationParts[0]?.trim() || 'Genel';
            const city = locationParts[1]?.trim() || 'İzmir';

            const code = newProject.name.toUpperCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 1000);

            const payload = {
                code: code,
                name: newProject.name,
                city: city,
                district: district,
                gps_lat: lat,
                gps_lng: lng,
                status: 'ACTIVE'
            };

            // Backend'e Gönder
            let url = serverUrl;
            if (!url.startsWith('http')) url = `http://${url}`;
            if (!url.includes('/api/v1/projects')) url = `${url}/api/v1/projects`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json(); // Hata mesajını görmek için oku

            if (res.ok) {
                const newP: Project = {
                    id: data.id,
                    name: data.name, // createProject yanıtında da 'name' döner
                    location: (data.district && data.city) ? `${data.district}, ${data.city}` : data.address || 'Konum Belirtilmemiş',
                    color: '#00E676',
                    coords: { lat: Number(data.gps_lat), lng: Number(data.gps_lng) }
                };
                setProjects([...projects, newP]);
                setActiveProject(newP);
                setScreen('dashboard');
                showToast('✅ Yeni Şantiye Oluşturuldu!', 'success');
            } else {
                console.error('Backend Hatası:', data);
                showToast(`Hata: ${data.message || 'Sunucu hatası'}`, 'error');
            }
        } catch (e) {
            showToast('Proje oluşturulamadı (Offline?)', 'error');
            console.error(e);
        }
        setProcessing(false);
    };


    /* 3. VERİ YÖNETİMİ */
    const loadLocalData = async (urlToUse: string) => {
        const { value } = await Preferences.get({ key: 'waybills_local' });
        if (value) {
            const savedWaybills = JSON.parse(value) as Waybill[];
            setWaybills(savedWaybills);

            const pending = savedWaybills.filter(w => !w.synced).length;
            setPendingSyncCount(pending);

            if (pending > 0 && urlToUse) {
                syncPendingData(urlToUse, savedWaybills);
            }
        }
    };

    const saveWaybill = async (newWaybill: Waybill) => {
        const updatedList = [newWaybill, ...waybills];
        setWaybills(updatedList);
        setPendingSyncCount(prev => prev + 1);

        await Preferences.set({ key: 'waybills_local', value: JSON.stringify(updatedList) });

        if (serverUrl) {
            trySyncSingle(newWaybill, updatedList);
        } else {
            showToast('⚠️ Sunucu Ayarı Yok -> Sadece Telefona Kaydedildi', 'info');
        }
    };

    const trySyncSingle = async (item: Waybill, currentList: Waybill[]) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            let safeUrl = serverUrl;
            if (!safeUrl.startsWith('http')) safeUrl = `http://${safeUrl}`;
            if (!safeUrl.includes('/api/v1/transactions')) safeUrl = `${safeUrl}/api/v1/transactions`;

            const formDataPayload = new FormData();
            formDataPayload.append('project_id', item.projectId);
            formDataPayload.append('material_type', item.material);
            formDataPayload.append('quantity', item.quantity.toString());
            formDataPayload.append('unit', item.unit);
            formDataPayload.append('plate_number', item.plateNo);
            formDataPayload.append('supplier_name', item.supplier);
            formDataPayload.append('ticket_number', item.waybillNo);
            formDataPayload.append('type', 'IN');

            if (item.date) {
                const isoDate = new Date(item.date).toISOString();
                formDataPayload.append('transaction_date', isoDate);
            }

            if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
                const response = await fetch(item.imageUrl);
                const blob = await response.blob();
                formDataPayload.append('file', blob, 'receipt.jpg');
            }

            const response = await fetch(safeUrl, {
                method: 'POST',
                body: formDataPayload,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const newList = currentList.map(w => w.id === item.id ? { ...w, synced: true } : w);
                setWaybills(newList);
                await Preferences.set({ key: 'waybills_local', value: JSON.stringify(newList) });
                setPendingSyncCount(prev => Math.max(0, prev - 1));
                showToast('✅ Sunucuya Gönderildi', 'success');
            } else {
                throw new Error('Server Error');
            }
        } catch (error) {
            // Silent fail
        }
    };

    const syncPendingData = async (urlOverride?: string, listToSync = waybills) => {
        const pendingItems = listToSync.filter(w => !w.synced);
        if (pendingItems.length === 0) return;

        let currentUrl = urlOverride || serverUrl;
        if (!currentUrl) return;
        if (!currentUrl.startsWith('http')) currentUrl = `http://${currentUrl}`;
        if (!currentUrl.includes('/api/v1/transactions')) currentUrl = `${currentUrl}/api/v1/transactions`;

        showToast(`🔄 ${pendingItems.length} işlem sunucuya aktarılıyor...`, 'info');

        let successCount = 0;
        let newList = [...listToSync];

        for (const item of pendingItems) {
            try {
                const formDataPayload = new FormData();
                formDataPayload.append('project_id', item.projectId);
                formDataPayload.append('material_type', item.material);
                formDataPayload.append('quantity', item.quantity.toString());
                formDataPayload.append('unit', item.unit);
                formDataPayload.append('plate_number', item.plateNo);
                formDataPayload.append('supplier_name', item.supplier);
                formDataPayload.append('ticket_number', item.waybillNo);
                formDataPayload.append('type', 'IN');

                if (item.date) {
                    const isoDate = new Date(item.date).toISOString();
                    formDataPayload.append('transaction_date', isoDate);
                }

                if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
                    const res = await fetch(item.imageUrl);
                    const blob = await res.blob();
                    formDataPayload.append('file', blob, 'receipt.jpg');
                }

                const response = await fetch(currentUrl, {
                    method: 'POST',
                    body: formDataPayload
                });

                if (response.ok) {
                    newList = newList.map(w => w.id === item.id ? { ...w, synced: true } : w);
                    successCount++;
                }
            } catch (e) {
                // Continue
            }
        }

        setWaybills(newList);
        await Preferences.set({ key: 'waybills_local', value: JSON.stringify(newList) });
        setPendingSyncCount(pendingItems.length - successCount);

        if (successCount > 0) {
            showToast(`✅ ${successCount} işlem başarıyla senkronize edildi!`, 'success');
        }
    };

    const handleSaveSettings = async () => {
        await Preferences.set({ key: 'server_url', value: serverUrl });
        showToast('✅ Ayarlar Kaydedildi', 'success');
        loadProjects(serverUrl);
        setScreen('dashboard');
    };


    /* 4. EKRANLAR */

    // İSTATİSTİK & RAPOR EKRANI
    if (screen === 'stats') {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const projectWaybills = waybills.filter(w => w.projectId === activeProject?.id);

        const filteredWaybills = projectWaybills.filter(w => {
            const d = new Date(w.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const stats: Record<string, { count: number, totalQty: number, unit: string }> = {};

        filteredWaybills.forEach(w => {
            if (!stats[w.material]) {
                stats[w.material] = { count: 0, totalQty: 0, unit: w.unit };
            }
            stats[w.material].count += 1;
            stats[w.material].totalQty += w.quantity;
        });

        return (
            <div className="app-container">
                <header className="app-header">
                    <div className="header-title">
                        <div className="header-subtitle" onClick={() => setScreen('dashboard')} style={{ display: 'flex', alignItems: 'center' }}>
                            <ChevronRight size={16} transform="rotate(180)" style={{ marginRight: 5 }} /> Geri Dön
                        </div>
                        <h1>Proje Raporu</h1>
                        <p style={{ fontSize: 12, color: '#FFD600' }}>{activeProject?.name}</p>
                    </div>
                </header>

                <div style={{ padding: 20 }}>
                    <div style={{ background: '#333', borderRadius: 12, padding: 15, marginBottom: 20 }}>
                        <h3 style={{ color: '#fff', margin: 0 }}>Bu Ay ({new Date().toLocaleString('tr-TR', { month: 'long' })})</h3>
                        <p style={{ color: '#888', fontSize: 13 }}>Toplam Hareket: {filteredWaybills.length}</p>
                        <p style={{ color: '#666', fontSize: 11 }}>* Sadece bu şantiyeye ait verilerdir.</p>
                    </div>

                    <h4 style={{ color: '#FFD600', marginBottom: 15, borderBottom: '1px solid #444', paddingBottom: 5 }}>Malzeme Dökümü</h4>

                    {Object.keys(stats).length === 0 ? (
                        <p style={{ color: '#666', textAlign: 'center' }}>Bu ay hiç kayıt yok.</p>
                    ) : (
                        Object.entries(stats).map(([material, data]) => (
                            <div key={material} style={{
                                background: 'rgba(255,255,255,0.05)',
                                marginBottom: 10, padding: 15, borderRadius: 10,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{material}</div>
                                    <div style={{ color: '#888', fontSize: 12 }}>{data.count} Sefer</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: 'var(--color-brand-primary)', fontSize: 18, fontWeight: 'bold' }}>
                                        {data.totalQty.toLocaleString()} <span style={{ fontSize: 12 }}>{data.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // INTRO
    if (screen === 'intro') {
        return (
            <div className="intro-screen">
                <div className="intro-logo">
                    <img src="/logo.png" alt="YMH" style={{ width: '100%', borderRadius: 20 }} />
                </div>
                <div className="intro-text" style={{ marginTop: 20, color: '#FFD600' }}>SAHA'M</div>
                <div style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
                    {isOnline ? 'Online Mod' : 'Çevrimdışı Mod'}
                </div>
            </div>
        );
    }

    // AYARLAR
    if (screen === 'settings') {
        return (
            <div className="form-modal" style={{ background: '#111' }}>
                <div className="form-header">
                    <h2>Sunucu Ayarları</h2>
                    <button className="close-btn" onClick={() => setScreen('dashboard')}><X size={32} /></button>
                </div>
                <div style={{ padding: 20 }}>
                    <div className="form-group">
                        <label className="form-label">Sunucu Adresi (IP:Port)</label>
                        <input type="text" className="form-input" placeholder="Örn: 192.168.1.35:3000" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
                    </div>
                    <button className="submit-btn" style={{ marginTop: 30 }} onClick={handleSaveSettings}>
                        <Save size={18} style={{ marginRight: 8 }} /> AYARLARI KAYDET
                    </button>
                </div>
            </div>
        );
    }

    // YENİ PROJE OLUŞTUR
    if (screen === 'create-project') {
        return (
            <div className="form-modal">
                <div className="form-header">
                    <h2>Yeni Şantiye Ekle</h2>
                    <button className="close-btn" onClick={() => setScreen('project-select')}><X size={32} /></button>
                </div>
                <div style={{ padding: 20 }}>
                    <div className="form-group">
                        <label className="form-label">Şantiye Adı</label>
                        <input type="text" className="form-input" placeholder="Örn: Menemen Konutları" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Konum / Adres</label>
                        <input type="text" className="form-input" placeholder="Örn: Menemen, İzmir" value={newProject.location} onChange={e => setNewProject({ ...newProject, location: e.target.value })} />
                    </div>

                    <div style={{ background: 'rgba(255, 214, 0, 0.1)', padding: 15, borderRadius: 10, marginTop: 20 }}>
                        <p style={{ fontSize: 12, color: '#FFD600' }}>
                            <MapPin size={12} style={{ marginRight: 5 }} />
                            Kaydettiğinizde şu anki GPS konumunuz şantiye merkezi olarak atanacaktır.
                        </p>
                    </div>

                    <button className="submit-btn" style={{ marginTop: 30 }} onClick={handleCreateProject}>
                        {processing ? 'Oluşturuluyor...' : 'ŞANTİYEYİ OLUŞTUR'}
                    </button>
                </div>
            </div>
        );
    }

    // PROJE SEÇİMİ
    if (screen === 'project-select') {
        return (
            <div className="login-container">
                <div className="header-brand" style={{ textAlign: 'center', marginBottom: 20 }}>
                    <img src="/logo.png" width="80" style={{ borderRadius: 16 }} alt="Logo" />
                    <div className="login-title" style={{ marginTop: 15 }}>Hangi Şantiyedesin?</div>
                    {projects.length === 0 && <p style={{ color: 'red' }}>Projeler yüklenemedi (Sunucu Yok)</p>}
                </div>

                {/* Proje Listesi */}
                <div style={{ maxHeight: '50vh', overflowY: 'auto', width: '100%' }}>
                    {projects.map(p => (
                        <div key={p.id} className="project-card" onClick={() => { setActiveProject(p); setScreen('dashboard'); }}>
                            <div className="project-icon" style={{ color: p.color }}><MapPin size={24} /></div>
                            <div className="project-info">
                                <h3 style={{ color: '#fff' }}>{p.name}</h3>
                                <p>{p.location}</p>
                            </div>
                            <ChevronRight color="#444" />
                        </div>
                    ))}
                </div>

                {/* Yeni Proje Butonu */}
                <button className="fab-btn"
                    style={{ width: '100%', borderRadius: 16, marginTop: 20, background: 'rgba(255,255,255,0.1)' }}
                    onClick={() => setScreen('create-project')}
                >
                    <Plus size={20} style={{ marginRight: 10 }} /> Yeni Şantiye Ekle
                </button>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <button onClick={() => setScreen('settings')} style={{ background: 'transparent', border: 'none', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                        <Settings size={16} style={{ marginRight: 5 }} /> Sunucu Ayarları
                    </button>
                </div>
            </div>
        );
    }

    // DASHBOARD
    return (
        <div className="app-container">
            {/* Network Status Bar */}
            {(!isOnline || pendingSyncCount > 0 || !serverUrl) && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: 30, zIndex: 9999,
                    background: (!serverUrl) ? '#444' : (isOnline ? '#FFA000' : '#FF3D00'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 'bold', color: '#fff'
                }}>
                    {!serverUrl ? (
                        <span onClick={() => setScreen('settings')}>⚠️ Sunucu Ayarlanmadı (Tıkla)</span>
                    ) : isOnline ? (
                        <span onClick={() => syncPendingData()}>⏳ {pendingSyncCount} işlem senkronize ediliyor...</span>
                    ) : (
                        <span>🚫 Çevrimdışı ({pendingSyncCount} Bekliyor)</span>
                    )}
                </div>
            )}

            {/* Header */}
            <header className="app-header" style={{ marginTop: (!isOnline || pendingSyncCount > 0 || !serverUrl) ? 30 : 0 }}>
                <div className="header-title">
                    <div className="header-subtitle" style={{ display: 'flex', alignItems: 'center' }}>
                        <Navigation size={12} style={{ marginRight: 4 }} /> AKTiF ŞANTİYE
                    </div>
                    <h1>{activeProject?.name}</h1>
                </div>
                <div className="user-avatar" style={{ position: 'relative' }} onClick={() => setScreen('project-select')}>
                    <Briefcase size={20} color="#fff" />
                </div>
            </header>

            {/* Info Card */}
            <div className="dashboard-grid">
                <div className="stat-card primary" style={{ background: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setScreen('stats')} >
                    <div className="stat-label" style={{ color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                        BUGÜN
                        <ChevronRight size={16} />
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--color-brand-primary)' }}>
                        {/** SADECE O GÜNÜN VERİSİNİ GÖSTER */}
                        {waybills.filter(w => w.date === new Date().toISOString().split('T')[0] && w.projectId === activeProject?.id).length} İŞLEM
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#888', margin: '5px 0' }}>
                        {/** Toplam sadece o proje ve o gün için */}
                        Toplam: {waybills
                            .filter(w => w.date === new Date().toISOString().split('T')[0] && w.projectId === activeProject?.id)
                            .reduce((acc, w) => acc + w.quantity, 0).toLocaleString()} br
                    </p>
                    <div style={{ marginTop: 5, fontSize: 10, color: '#FFD600', textAlign: 'right' }}>
                        Aylık Rapor &gt;
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="history-section">
                <div className="section-title">GÜNLÜK HAREKETLER</div>
                {waybills.filter(w => w.projectId === activeProject?.id).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
                        <Truck size={48} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <p>Henüz kayıt yok.</p>
                    </div>
                ) : (
                    waybills
                        .filter(w => w.projectId === activeProject?.id) // Sadece bu projenin verileri
                        .map(wb => (
                            <div key={wb.id} className="history-item">
                                <div className="history-icon" style={{ background: wb.isManual ? 'rgba(255,255,255,0.05)' : 'rgba(255, 214, 0, 0.1)' }}>
                                    {wb.isManual ? <Edit3 size={18} color="#fff" /> : <CameraIcon size={18} color="#FFD600" />}
                                </div>
                                <div className="history-details">
                                    <div className="history-title" style={{ color: '#fff' }}>
                                        {wb.plateNo} - {wb.material}
                                    </div>
                                    <div className="history-date">
                                        {wb.supplier} • {wb.waybillNo}
                                    </div>
                                </div>
                                <div className="history-amount" style={{
                                    color: wb.synced ? 'var(--color-brand-primary)' : '#FF3D00',
                                    fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end'
                                }}>
                                    <span>{wb.quantity} {wb.unit}</span>
                                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                                        {wb.synced ? 'İletildi' : 'Bekliyor'}
                                    </span>
                                </div>
                            </div>
                        ))
                )}
            </div>

            {/* Toast */}
            {toastMessage && (
                <div style={{
                    position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
                    background: toastMessage.type === 'error' ? 'rgba(255, 61, 0, 0.95)' : 'rgba(50,50,50,0.95)',
                    color: '#fff', padding: '12px 24px',
                    borderRadius: 30, zIndex: 999, fontSize: 13, fontWeight: 500,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', textAlign: 'center'
                }}>
                    {toastMessage.msg}
                </div>
            )}

            {/* Loader */}
            {processing && (
                <div className="form-modal" style={{ justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.9)' }}>
                    <Loader className="intro-logo" size={64} color="#FFD600" />
                    <h2 style={{ marginTop: 20 }}>Sistem Güncelleniyor...</h2>
                </div>
            )}

            {/* Actions */}
            {showActionMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 150 }}
                        onClick={() => setShowActionMenu(false)} />

                    <div className="fab-container" style={{ bottom: 100, flexDirection: 'column' }}>
                        <button className="fab-btn" style={{ width: 'auto', padding: '0 20px', borderRadius: 16 }} onClick={() => { /* handleCamera */ }}>
                            <CameraIcon style={{ marginRight: 10 }} /> İrsaliye Tara (OCR)
                        </button>
                        <button className="fab-btn" style={{ width: 'auto', padding: '0 20px', borderRadius: 16, background: '#fff' }} onClick={() => { setShowManualForm(true); setShowActionMenu(false); }}>
                            <Edit3 style={{ marginRight: 10 }} /> Manuel Giriş
                        </button>
                    </div>
                </>
            )}

            <div className="fab-container">
                <button className="fab-btn" onClick={() => setShowActionMenu(!showActionMenu)} style={{ transform: showActionMenu ? 'rotate(45deg)' : 'none' }}>
                    <Plus size={32} />
                </button>
            </div>

            {/* MANUEL FORM */}
            {showManualForm && (
                <div className="form-modal">
                    <div className="form-header">
                        <h2>İrsaliye Girişi</h2>
                        <button className="close-btn" onClick={() => setShowManualForm(false)}><X size={32} /></button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 50 }}>
                        {/* Form Fields Same as Before */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                            <div className="form-group">
                                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Tarih</label>
                                <input type="date" className="form-input" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label"><FileText size={14} style={{ display: 'inline', marginRight: 4 }} /> İrsaliye No</label>
                                <input type="text" className="form-input" placeholder="12345" value={formData.waybillNo} onChange={e => setFormData({ ...formData, waybillNo: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label"><Truck size={14} style={{ display: 'inline', marginRight: 4 }} /> Plaka No (Zorunlu)</label>
                            <input type="text" className="form-input" placeholder="35 ABC 123"
                                value={formData.plateNo} onChange={e => setFormData({ ...formData, plateNo: e.target.value.toUpperCase() })}
                                style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: 1 }} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tedarikçi Firma</label>
                            <input type="text" className="form-input" placeholder="Örn: Beta Beton" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label"><Package size={14} style={{ display: 'inline', marginRight: 4 }} /> Malzeme Cinsi</label>
                            <select className="form-input" value={formData.material} onChange={e => setFormData({ ...formData, material: e.target.value })} style={{ appearance: 'none', color: formData.material ? '#fff' : '#888' }}>
                                <option value="">Seçiniz...</option>
                                {MATERIALS.map(m => <option key={m} value={m} style={{ color: '#000' }}>{m}</option>)}
                            </select>
                        </div>

                        {formData.material === 'Diğer' && (
                            <div className="form-group" style={{ animation: 'fadeIn 0.3s' }}>
                                <input type="text" className="form-input"
                                    placeholder="Malzeme Adını Yazınız"
                                    value={formData.customMaterial}
                                    onChange={e => setFormData({ ...formData, customMaterial: e.target.value })}
                                    style={{ border: '1px solid #FFD600' }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 15 }}>
                            <div className="form-group">
                                <label className="form-label"><Scale size={14} style={{ display: 'inline', marginRight: 4 }} /> Miktar</label>
                                <input type="number" step="0.001" className="form-input" placeholder="0.000" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Birim</label>
                                <select className="form-input" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                    {UNITS.map(u => <option key={u} value={u} style={{ color: '#000' }}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">İrsaliye Fotoğrafı</label>
                            <div className="photo-upload-btn" onClick={() => {/* handlePhotoUpload */ }}>
                                {formData.image ? (
                                    <>
                                        <img src={formData.image} className="photo-preview" alt="Preview" />
                                        <span style={{ color: '#00E676', display: 'flex', alignItems: 'center' }}><CheckCircle size={16} style={{ marginRight: 5 }} /> Fotoğraf Eklendi</span>
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon size={32} />
                                        <span>Dokun ve Yükle</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <button className="submit-btn" onClick={() => {
                            /* Manuel Sumbit Logic */
                            const finalMaterial = formData.material === 'Diğer' ? formData.customMaterial : formData.material;
                            if (!finalMaterial || !formData.quantity || !formData.plateNo) {
                                showToast('⚠️ Eksik Bilgi', 'error');
                                return;
                            }
                            const newWaybill: Waybill = {
                                id: Date.now().toString(),
                                projectId: activeProject?.id || '',
                                projectName: activeProject?.name || 'Genel',
                                date: formData.date,
                                plateNo: formData.plateNo.toUpperCase(),
                                material: finalMaterial,
                                quantity: parseFloat(formData.quantity.replace(',', '.')),
                                unit: formData.unit,
                                supplier: formData.supplier || 'Bilinmiyor',
                                waybillNo: formData.waybillNo || '-',
                                imageUrl: formData.image || undefined,
                                isManual: true,
                                synced: false
                            };
                            saveWaybill(newWaybill);
                            setShowManualForm(false);
                            setFormData({ ...formData, plateNo: '', quantity: '', image: null });
                        }}>KAYDET</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
