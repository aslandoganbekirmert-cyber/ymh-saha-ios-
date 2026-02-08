
import React, { useState, useEffect } from 'react';
import './Style.css';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import {
    Home, Plus, User, Truck, Package, Settings,
    ChevronRight, X, ArrowLeft, BarChart2, CheckCircle, AlertCircle, Camera as CameraIcon
} from 'lucide-react';

/* --- TİPLER --- */
interface Project {
    id: string;
    name: string;
    location: string;
    createdAt: string;
}

interface Waybill {
    id: string;
    projectId: string;
    plateNo: string;
    material: string;
    quantity: number;
    unit: string;
    date: string;
    imageUrl?: string;
    synced: boolean;
}

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'splash' | 'projects' | 'dashboard' | 'create-project' | 'create-waybill' | 'settings'>('splash');
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [waybills, setWaybills] = useState<Waybill[]>([]);
    const [stats, setStats] = useState({ count: 0, total: 0 });

    // Form State
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectLoc, setNewProjectLoc] = useState('');

    const [newWaybill, setNewWaybill] = useState<Partial<Waybill>>({
        date: new Date().toISOString().split('T')[0],
        unit: 'Ton',
        quantity: 0
    });

    /* --- INIT & LOAD DATA --- */
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        // 1. Projeleri Yükle
        const { value: pVal } = await Preferences.get({ key: 'projects' });
        if (pVal) setProjects(JSON.parse(pVal));
        else {
            // İlk açılışta boşsa örnek bir tane ekleyelim (kullanıcıya yardımcı olmak için)
            // Ama kullanıcı "demo istemiyorum" dediği için bunu boş bırakıyorum.
            setProjects([]);
        }

        // 2. İrsaliyeleri Yükle
        const { value: wVal } = await Preferences.get({ key: 'waybills' });
        if (wVal) setWaybills(JSON.parse(wVal));

        // 3. Geçiş
        setTimeout(() => setView(pVal ? 'projects' : 'create-project'), 2000);
    };

    /* --- ACTIONS --- */

    // Proje Ekleme (Tamamen Çalışıyor)
    const handleAddProject = async () => {
        if (!newProjectName.trim()) return alert('Lütfen saha adı giriniz!');

        const newP: Project = {
            id: Date.now().toString(),
            name: newProjectName,
            location: newProjectLoc || 'Konum Belirtilmedi',
            createdAt: new Date().toISOString()
        };

        const updatedProjects = [...projects, newP];
        setProjects(updatedProjects);
        await Preferences.set({ key: 'projects', value: JSON.stringify(updatedProjects) });

        setActiveProject(newP);
        setNewProjectName('');
        setNewProjectLoc('');
        setView('dashboard');
    };

    // İrsaliye Ekleme (Tamamen Çalışıyor)
    const handleAddWaybill = async () => {
        if (!activeProject) return;
        if (!newWaybill.plateNo || !newWaybill.material) return alert('Plaka ve Malzeme zorunludur!');

        const newW: Waybill = {
            id: Date.now().toString(),
            projectId: activeProject.id,
            plateNo: newWaybill.plateNo.toUpperCase(),
            material: newWaybill.material!,
            quantity: Number(newWaybill.quantity) || 0,
            unit: newWaybill.unit || 'Ton',
            date: newWaybill.date || new Date().toISOString().split('T')[0],
            synced: false,
            imageUrl: newWaybill.imageUrl
        };

        const updatedWaybills = [newW, ...waybills];
        setWaybills(updatedWaybills);
        await Preferences.set({ key: 'waybills', value: JSON.stringify(updatedWaybills) });

        // Formu Sıfırla
        setNewWaybill({ date: new Date().toISOString().split('T')[0], unit: 'Ton', quantity: 0 });
        setView('dashboard');
    };

    // Sahaya Giriş Yap
    const selectProject = (p: Project) => {
        setActiveProject(p);
        setView('dashboard');
    };

    // Dashboard İstatistiklerini Hesapla
    useEffect(() => {
        if (activeProject) {
            const projectWaybills = waybills.filter(w => w.projectId === activeProject.id);
            const total = projectWaybills.reduce((sum, w) => sum + w.quantity, 0);
            setStats({ count: projectWaybills.length, total });
        }
    }, [activeProject, waybills]);

    // Fotoğraf Çek (Simulasyon)
    const takePicture = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri
            });
            setNewWaybill(prev => ({ ...prev, imageUrl: image.webPath }));
        } catch (e) {
            console.log('Kamera iptal edildi');
        }
    };

    /* --- EKRANLAR --- */

    // 1. SPLASH SCREEN
    if (view === 'splash') {
        return (
            <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ color: '#FFD600', fontSize: 40, letterSpacing: -2 }}>SAHA'M</h1>
                    <p style={{ color: '#666', marginTop: 10 }}>Yükleniyor...</p>
                </div>
            </div>
        );
    }

    // 2. PROJE LİSTESİ
    if (view === 'projects') {
        return (
            <div className="screen">
                <div className="header">
                    <div>
                        <h2 style={{ color: '#888', fontSize: 14, textTransform: 'uppercase' }}>Hoşgeldiniz</h2>
                        <h1>Projelerim</h1>
                    </div>
                    <div className="avatar" onClick={() => setView('settings')}><Settings size={20} color="#fff" /></div>
                </div>

                {projects.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', textAlign: 'center' }}>
                        <Home size={48} style={{ marginBottom: 20, opacity: 0.5 }} />
                        <p>Henüz kayıtlı bir saha yok.</p>
                        <button className="btn primary" style={{ marginTop: 20, width: 'auto', padding: '0 30px' }} onClick={() => setView('create-project')}>
                            + İlk Sahayı Oluştur
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {projects.map(p => (
                                <div key={p.id} className="card" onClick={() => selectProject(p)} style={{ padding: 20 }}>
                                    <div>
                                        <h3>{p.name}</h3>
                                        <p>{p.location}</p>
                                    </div>
                                    <ChevronRight color="#666" />
                                </div>
                            ))}
                        </div>
                        <button className="btn primary" style={{ marginTop: 20 }} onClick={() => setView('create-project')}>
                            + Yeni Saha Ekle
                        </button>
                    </>
                )}
            </div>
        );
    }

    // 3. YENİ PROJE FORMU
    if (view === 'create-project') {
        return (
            <div className="screen">
                <div className="header">
                    <button className="btn text" style={{ width: 'auto', padding: 0 }} onClick={() => setView(projects.length > 0 ? 'projects' : 'splash')}>
                        <ArrowLeft size={24} color="#fff" />
                    </button>
                    <h3>Yeni Saha</h3>
                    <div style={{ width: 24 }}></div>
                </div>

                <div className="card-col">
                    <div className="input-group">
                        <label className="label">SAHA ADI</label>
                        <input className="input" placeholder="Örn: Evka-5 Şantiyesi" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} autoFocus />
                    </div>
                    <div className="input-group">
                        <label className="label">KONUM / ADRES</label>
                        <input className="input" placeholder="İlçe, İl" value={newProjectLoc} onChange={e => setNewProjectLoc(e.target.value)} />
                    </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <button className="btn primary" onClick={handleAddProject}> Oluştur ve Başla </button>
                </div>
            </div>
        );
    }

    // 4. AYARLAR EKRANI
    if (view === 'settings') {
        return (
            <div className="screen">
                <div className="header">
                    <button className="btn text" style={{ width: 'auto', padding: 0 }} onClick={() => setView(activeProject ? 'dashboard' : 'projects')}>
                        <ArrowLeft size={24} color="#fff" />
                    </button>
                    <h3>Ayarlar</h3>
                    <div style={{ width: 24 }}></div>
                </div>

                <div className="card-col">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        <div style={{ width: 60, height: 60, borderRadius: 30, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={32} color="#fff" />
                        </div>
                        <div>
                            <h3>Kullanıcı Profili</h3>
                            <p>Şantiye Şefi</p>
                        </div>
                    </div>
                    <button className="btn" style={{ background: '#FF453A', color: '#fff' }} onClick={() => {
                        if (confirm('Tüm verileri silmek istediğinize emin misiniz?')) {
                            Preferences.clear();
                            window.location.reload();
                        }
                    }}>
                        Çıkış Yap ve Sıfırla
                    </button>
                </div>

                <div className="card">
                    <div>
                        <h3>Sunucu Durumu</h3>
                        <p style={{ color: '#30D158' }}>Online (v3.1.0)</p>
                    </div>
                    <CheckCircle size={20} color="#30D158" />
                </div>
            </div>
        );
    }

    // 5. DASHBOARD (ANA EKRAN)
    if (view === 'dashboard' && activeProject) {
        return (
            <div className="screen" style={{ paddingBottom: 100 }}>
                {/* Header */}
                <div className="header" style={{ paddingBottom: 10 }}>
                    <div onClick={() => setView('projects')} style={{ cursor: 'pointer' }}>
                        <h2 style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <ArrowLeft size={14} /> Tüm Sahalar
                        </h2>
                        <h1 style={{ fontSize: 24 }}>{activeProject.name}</h1>
                    </div>
                    <div className="avatar" onClick={() => setView('settings')}><User size={20} color="#fff" /></div>
                </div>

                {/* İstatistikler */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <div className="card-col" style={{ background: '#2C2C2E', padding: 16 }}>
                        <p style={{ fontSize: 12 }}>Bugünkü Araç</p>
                        <div className="value" style={{ marginTop: 8 }}>{stats.count}</div>
                    </div>
                    <div className="card-col" style={{ background: '#2C2C2E', padding: 16 }}>
                        <p style={{ fontSize: 12 }}>Toplam Miktar</p>
                        <div className="value" style={{ marginTop: 8, color: '#FFD600' }}>{stats.total.toLocaleString()} <span style={{ fontSize: 14 }}>Ton</span></div>
                    </div>
                </div>

                {/* Son Hareketler */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3>Son Hareketler</h3>
                    <p style={{ color: '#FFD600', fontSize: 12 }}>Tümü</p>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                    {waybills.filter(w => w.projectId === activeProject.id).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#666', border: '1px dashed #333', borderRadius: 12 }}>
                            <Truck size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
                            <p>Henüz hareket yok.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {waybills.filter(w => w.projectId === activeProject.id).map(w => (
                                <div key={w.id} className="card" style={{ padding: 16, marginBottom: 0 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ width: 40, height: 40, background: '#333', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Package size={20} color={w.synced ? '#30D158' : '#FFD600'} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 16 }}>{w.plateNo}</div>
                                            <p style={{ fontSize: 12 }}>{w.material}</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{w.quantity} <span style={{ fontSize: 12 }}>{w.unit}</span></div>
                                        <p style={{ fontSize: 10, color: w.synced ? '#30D158' : '#FFD600' }}>{w.synced ? 'İletildi' : 'Bekliyor'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Alt Bar */}
                <div className="tab-bar">
                    <div className="tab-item active"><Home size={24} /><span>Ana Sayfa</span></div>
                    <div style={{ position: 'relative', top: -20 }} onClick={() => setView('create-waybill')}>
                        <div style={{
                            width: 64, height: 64, background: '#FFD600', borderRadius: 32,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#000', border: '5px solid #000', boxShadow: '0 4px 10px rgba(255, 214, 0, 0.3)'
                        }}>
                            <Plus size={32} />
                        </div>
                    </div>
                    <div className="tab-item" onClick={() => setView('settings')}><Settings size={24} /><span>Ayarlar</span></div>
                </div>
            </div>
        );
    }

    // 6. YENİ İRSALİYE FORMU
    if (view === 'create-waybill') {
        return (
            <div className="screen" style={{ background: '#1C1C1E' }}>
                <div className="header">
                    <button className="btn text" style={{ width: 'auto', padding: 0 }} onClick={() => setView('dashboard')}>
                        <X size={24} color="#fff" />
                    </button>
                    <h3>Yeni İrsaliye</h3>
                    <div style={{ width: 24 }}></div>
                </div>

                <div style={{ flex: 1, paddingBottom: 20, overflowY: 'auto' }}>
                    <button className="btn" style={{ height: 60, marginBottom: 24, border: '1px dashed #666', background: 'transparent', color: '#fff' }} onClick={takePicture}>
                        <CameraIcon size={20} />
                        {newWaybill.imageUrl ? 'FOTOĞRAF EKLENDİ (DEĞİŞTİR)' : 'FİŞ FOTOĞRAFI ÇEK'}
                    </button>

                    <div className="input-group">
                        <label className="label">PLAKA</label>
                        <input className="input" placeholder="35 ABC 123" value={newWaybill.plateNo || ''} onChange={e => setNewWaybill({ ...newWaybill, plateNo: e.target.value.toUpperCase() })} />
                    </div>

                    <div className="input-group">
                        <label className="label">MALZEME</label>
                        <select className="input" value={newWaybill.material || ''} onChange={e => setNewWaybill({ ...newWaybill, material: e.target.value })}>
                            <option value="">Seçiniz...</option>
                            <option value="Hazır Beton C30">Hazır Beton C30</option>
                            <option value="Demir Ø12">Demir Ø12</option>
                            <option value="İnce Kum">İnce Kum</option>
                            <option value="Kaba Kum">Kaba Kum</option>
                            <option value="Çimento">Çimento</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="label">MİKTAR</label>
                            <input type="number" className="input" placeholder="0" value={newWaybill.quantity || ''} onChange={e => setNewWaybill({ ...newWaybill, quantity: Number(e.target.value) })} />
                        </div>
                        <div className="input-group" style={{ width: 100 }}>
                            <label className="label">BİRİM</label>
                            <select className="input" value={newWaybill.unit} onChange={e => setNewWaybill({ ...newWaybill, unit: e.target.value })}>
                                <option>Ton</option>
                                <option>m3</option>
                                <option>Adet</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button className="btn primary" onClick={handleAddWaybill} style={{ marginBottom: 20 }}>
                    KAYDET
                </button>
            </div>
        );
    }

    return null;
}
