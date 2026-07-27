'use client';

import Image from 'next/image';
import * as htmlToImage from 'html-to-image';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Edit3, 
  History, 
  FileText, 
  Settings, 
  HelpCircle, 
  Calendar, 
  Clock, 
  Info, 
  RotateCcw, 
  Copy, 
  Image as ImageIcon, 
  Sparkles,
  Check,
  ChevronRight,
  X,
  Trash2,
  Layout,
  Search,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
type System = string;
type Section = 'editor' | 'templates' | 'history' | 'settings';

interface MaintenanceWindow {
  id: string;
  systems: System[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  additionalText?: string;
  showStandardText?: boolean;
  gmud?: string;
  type?: 'outage' | 'communication';
}

interface TranslatedContent {
  en: {
    title: string;
    intro: string;
    warning: string;
    windows: { systems: string; text: string }[];
  };
  zh: {
    title: string;
    intro: string;
    warning: string;
    windows: { systems: string; text: string }[];
  };
}

interface MemoSettings {
  department: string;
  manager: string;
  footerLine2: string;
  headerImage?: string;
  footerImage?: string;
  googleApiKey?: string;
  openaiApiKey?: string;
  customPrompt?: string;
}

interface MemoData {
  windows: MaintenanceWindow[];
  settings: MemoSettings;
  customIntro?: string;
  customTitlePt?: string;
}

interface Template {
  id: string;
  title: string;
  description: string;
  iconType: string;
  data: {
    windows: MaintenanceWindow[];
    customIntro?: string;
    customTitlePt?: string;
  };
}

interface HistoryItem {
  id: string;
  timestamp: number;
  data: MemoData;
}

const DEFAULT_PROMPT = `Translate the following IT maintenance memo into professional American English (en-US) and Simplified Chinese (zh-CN).

<<<<<<< HEAD
Language Guidelines:
1. English (en-US): Use standard American English spelling and formatting (e.g. Month Day, Year like "January 2, 2026", 12-hour AM/PM format like "11:00 PM to 1:00 AM").
2. Simplified Chinese (zh-CN): Use standard Simplified Chinese (简体中文) for corporate IT communications (e.g. "YYYY年M月D日", 24-hour time like "23:00 至 01:00").

Instructions for Maintenance Windows:
- For English (en-US), if Start Date and End Date are identical, format like: "On March 29, 2026, from 8:00 AM to 12:00 PM." If dates differ, format like: "Starting on March 29 at 10:00 PM until March 30 at 4:00 AM."
- For Simplified Chinese (zh-CN), format like: "维护时间：2026年3月29日 22:00 至 2026年3月30日 04:00。"
- If "Include Standard Text" is false, ONLY use the additional details text for the window description.
- If "Include Standard Text" is true and additional details exist, blend the timing sentence and additional details naturally.
- CRITICAL: In the JSON result, the "systems" field MUST strictly contain ONLY the system names (e.g., "SGBOM", "Protheus", "Fluig"). Do NOT append any GMUD numbers or references like "(GMUD 1840)" or "GMUD: 1840" to the systems field under any circumstances.
=======
Instructions for Windows:
- Use a descriptive sentence format.
- For English (en), use the 12-hour clock format (AM/PM) for times (e.g., 9:00 PM instead of 21:00h).
- For Simplified Chinese (zh), use the 24-hour clock format for times (e.g., 21:00 instead of 9:00 PM).
- If Start Date and End Date are the same, format for English like: "March 29, 2026 (Sunday) starting at 8:00 AM with an estimated completion by 12:00 PM."
- If they are different, format for English like: "Starting on March 29 (Sunday) at 10:00 PM with an estimated completion on March 30 (Monday) at 4:00 AM."
- IMPORTANT: If "Include Standard Text" is false, ONLY use the additional details/observation text for the window description. Do not include the timing sentence.
- IMPORTANT: If "Include Standard Text" is true AND a window has additional details, integrate those details naturally into the descriptive sentence.
- IMPORTANT: In the JSON result, the "systems" field must ONLY contain the translated or original system names (e.g., "SGBOM", "Protheus"). Do NOT append any GMUD numbers or references like "(GMUD 1840)" or "GMUD: 1840" to the systems field under any circumstances.
- Translate these formats appropriately for English and Chinese, ensuring localized date and time conventions are followed.
>>>>>>> 3026a03aa7f2d5d1938d1e68e4641e3111f9c05b

Return the translations in a JSON format matching this schema:
{
  "en": { "title": "string", "intro": "string", "warning": "string", "windows": [{ "systems": "string", "text": "string" }] },
  "zh": { "title": "string", "intro": "string", "warning": "string", "windows": [{ "systems": "string", "text": "string" }] }
}`;

const INITIAL_WINDOW: MaintenanceWindow = {
  id: '1',
  systems: ['Greendocs'],
  startDate: '2026-01-02',
  endDate: '2026-01-03',
  startTime: '23:00',
  endTime: '01:00',
  additionalText: '',
  showStandardText: true,
  gmud: '',
  type: 'outage'
};

const INITIAL_DATA: MemoData = {
  windows: [INITIAL_WINDOW],
  settings: {
    department: 'Departamento de TI',
    manager: 'Gestão de Infraestrutura e Redes',
    footerLine2: 'Suporte Técnico Especializado',
    headerImage: '',
    footerImage: '',
    customPrompt: ''
  },
  customIntro: 'Informamos que realizaremos uma manutenção técnica essencial para garantir a estabilidade e performance de nossa infraestrutura digital.',
  customTitlePt: 'Parada Programada'
};

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'emergency',
    title: 'Manutenção Emergencial',
    description: 'Para correções críticas imediatas que não podem aguardar a janela padrão.',
    iconType: 'sparkles',
    data: {
      customIntro: 'Informamos que realizaremos uma manutenção emergencial crítica para corrigir falhas que impactam a operação imediata.',
      windows: [{
        id: 'temp-1',
        systems: ['Protheus', 'Fluig'],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '18:00',
        endTime: '20:00',
      }]
    }
  },
  {
    id: 'infra',
    title: 'Infraestrutura de Rede',
    description: 'Atualização de switches, roteadores e servidores de arquivos.',
    iconType: 'settings',
    data: {
      customIntro: 'Informamos que realizaremos atualizações em nossa infraestrutura de rede para melhorar a conectividade e segurança dos dados.',
      windows: [{
        id: 'temp-1',
        systems: ['Greendocs', 'SGBOM'],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        startTime: '22:00',
        endTime: '04:00',
      }]
    }
  },
  {
    id: 'erp-update',
    title: 'Atualização de ERP',
    description: 'Janela longa para virada de versão ou aplicação de patches pesados.',
    iconType: 'file',
    data: {
      customIntro: 'Informamos que o sistema ERP passará por uma atualização de versão programada para implementação de novas funcionalidades e correções.',
      windows: [{
        id: 'temp-1',
        systems: ['Protheus'],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        startTime: '20:00',
        endTime: '08:00',
      }]
    }
  }
];

const ICON_MAP: Record<string, React.ReactNode> = {
  sparkles: <Sparkles size={20} />,
  settings: <Settings size={20} />,
  file: <FileText size={20} />,
  rotate: <RotateCcw size={20} />,
  check: <Check size={20} />,
  calendar: <Calendar size={20} />,
  info: <Info size={20} />,
  plus: <Plus size={20} />
};

const getDayOfWeek = (dateStr: string) => {
  if (!dateStr) return '';
  // Use a fixed time to avoid timezone shifts
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
};

const formatDateLong = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const formatted = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  // Capitalize month name for a more formal look: "29 de março" -> "29 de Março"
  return formatted.replace(/de (\w)/g, (match, p1) => `de ${p1.toUpperCase()}`);
};

const formatWindowFullTextPt = (window: MaintenanceWindow) => {
  const startDay = getDayOfWeek(window.startDate);
  const startDate = formatDateLong(window.startDate);
  let text = '';
  
  if (window.showStandardText !== false) {
    if (window.startDate === window.endDate || !window.endDate) {
      text = `${startDate} (${startDay}) iniciando às ${window.startTime}h com previsão de término para às ${window.endTime}h.`;
    } else {
      const endDay = getDayOfWeek(window.endDate);
      const endDate = formatDateLong(window.endDate);
      text = `Iniciando em ${startDate} (${startDay}) às ${window.startTime}h com previsão de término para ${endDate} (${endDay}) às ${window.endTime}h.`;
    }
  }

  if (window.additionalText) {
    text += (text ? ' ' : '') + window.additionalText;
  }
  return text;
};

const formatWindowDateRange = (startDate: string, endDate: string) => {
  if (!startDate) return '';
  if (!endDate || startDate === endDate) {
    const dayOfWeek = getDayOfWeek(startDate);
    const fullDate = formatDateLong(startDate);
    return `${dayOfWeek}, ${fullDate}`;
  }
  
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  if (startYear !== endYear) {
    const startDayOfWeek = getDayOfWeek(startDate);
    const startFull = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const endDayOfWeek = getDayOfWeek(endDate);
    const endFull = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `De ${startDayOfWeek}, ${startFull} a ${endDayOfWeek}, ${endFull}`;
  }
  
  const startDayOfWeek = getDayOfWeek(startDate);
  const startDay = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const endDayOfWeek = getDayOfWeek(endDate);
  const endFull = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  return `De ${startDayOfWeek}, ${startDay} a ${endDayOfWeek}, ${endFull}`;
};

const calculateWindowDuration = (window: MaintenanceWindow) => {
  if (!window.startDate || !window.startTime || !window.endTime) return 'N/A';
  try {
    const startDateTime = new Date(`${window.startDate}T${window.startTime}`);
    const endDateTime = new Date(`${window.endDate || window.startDate}T${window.endTime}`);
    
    let diffMs = endDateTime.getTime() - startDateTime.getTime();
    if (diffMs < 0) {
      if (window.startDate === window.endDate || !window.endDate) {
        const nextDay = new Date(window.startDate + 'T12:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];
        const adjustedEnd = new Date(`${nextDayStr}T${window.endTime}`);
        diffMs = adjustedEnd.getTime() - startDateTime.getTime();
      }
    }
    
    if (diffMs < 0) return 'N/A';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  } catch (e) {
    return 'N/A';
  }
};

export default function ITMemoGenerator() {
  const [data, setData] = useState<MemoData>(INITIAL_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGeneratedCurrent, setHasGeneratedCurrent] = useState(false);

  useEffect(() => {
    setHasGeneratedCurrent(false);
  }, [data]);
  const [activeSection, setActiveSection] = useState<Section>('editor');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState<'all' | 'outage' | 'communication'>('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslatedContent | null>(null);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [isUploadingFooter, setIsUploadingFooter] = useState(false);
  const lastTranslatedDataRef = useRef<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [systemOptions, setSystemOptions] = useState<string[]>(['Protheus', 'Fluig', 'SGBOM', 'Greendocs', 'Projuris', 'I.A']);
  const [newSystemName, setNewSystemName] = useState<string>('');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleAddSystem = () => {
    const trimmed = newSystemName.trim();
    if (!trimmed) return;
    if (systemOptions.includes(trimmed)) {
      showToast('Este sistema já está na lista!', 'error');
      return;
    }
    const updated = [...systemOptions, trimmed];
    setSystemOptions(updated);
    localStorage.setItem('it-memo-system-options', JSON.stringify(updated));
    setNewSystemName('');
    showToast('Sistema adicionado com sucesso!');
  };

  const handleRemoveSystem = (sys: string) => {
    const updated = systemOptions.filter(s => s !== sys);
    setSystemOptions(updated);
    localStorage.setItem('it-memo-system-options', JSON.stringify(updated));
    
    // Also remove this system from selected systems in all windows, to keep data clean
    setData(prev => ({
      ...prev,
      windows: prev.windows.map(w => ({
        ...w,
        systems: w.systems.filter(s => s !== sys)
      }))
    }));
    showToast(`Sistema "${sys}" removido das opções.`);
  };

  useEffect(() => {
    // Load history
    const savedHistory = localStorage.getItem('it-memo-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }

    // Load settings
    const savedSettings = localStorage.getItem('it-memo-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings && typeof settings === 'object') {
          // Migration: If the custom prompt contains the old time format example or lacks Chinese 24h spec, clear it to use the new default
          if (settings.customPrompt && (settings.customPrompt.includes('08:00h') || !settings.customPrompt.includes('24-hour'))) {
            settings.customPrompt = '';
            localStorage.setItem('it-memo-settings', JSON.stringify(settings));
          }
          setData(prev => ({ ...prev, settings: { ...prev.settings, ...settings } }));
        }
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }

    // Load templates
    const savedTemplates = localStorage.getItem('it-memo-templates');
    if (savedTemplates) {
      try {
        const parsed = JSON.parse(savedTemplates);
        if (Array.isArray(parsed)) {
          setTemplates(parsed);
        }
      } catch (e) {
        console.error('Failed to parse templates', e);
      }
    }

    // Load auto-translate preference
    const savedAutoTranslate = localStorage.getItem('it-memo-auto-translate');
    if (savedAutoTranslate !== null) {
      setAutoTranslate(savedAutoTranslate === 'true');
    }

    // Load system options
    const savedSystems = localStorage.getItem('it-memo-system-options');
    if (savedSystems) {
      try {
        const parsed = JSON.parse(savedSystems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSystemOptions(parsed);
        }
      } catch (e) {
        console.error('Failed to parse system options', e);
      }
    }
  }, []);

  const compressImage = (dataUrl: string, maxWidth: number = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(dataUrl); // Fallback to original if error
    });
  };

  const saveToHistory = (memoData: MemoData) => {
    try {
      // Check if an exactly identical record already exists in history
      const isDuplicate = history.some(item => {
        const itemData = item.data;
        if ((itemData.customTitlePt || '') !== (memoData.customTitlePt || '')) return false;
        if ((itemData.customIntro || '') !== (memoData.customIntro || '')) return false;
        
        const windows1 = memoData.windows || [];
        const windows2 = itemData.windows || [];
        if (windows1.length !== windows2.length) return false;
        
        for (let i = 0; i < windows1.length; i++) {
          const w1 = windows1[i];
          const w2 = windows2[i];
          
          if ((w1.type || 'outage') !== (w2.type || 'outage')) return false;
          if ((w1.gmud || '') !== (w2.gmud || '')) return false;
          if (w1.startDate !== w2.startDate) return false;
          if (w1.endDate !== w2.endDate) return false;
          if (w1.startTime !== w2.startTime) return false;
          if (w1.endTime !== w2.endTime) return false;
          if ((w1.additionalText || '') !== (w2.additionalText || '')) return false;
          if ((w1.showStandardText !== false) !== (w2.showStandardText !== false)) return false;
          
          const systems1 = w1.systems || [];
          const systems2 = w2.systems || [];
          if (systems1.length !== systems2.length) return false;
          
          const sortedSys1 = [...systems1].sort();
          const sortedSys2 = [...systems2].sort();
          for (let j = 0; j < sortedSys1.length; j++) {
            if (sortedSys1[j] !== sortedSys2[j]) return false;
          }
        }
        
        return true;
      });

      if (isDuplicate) {
        console.log('Record is duplicate, skipping history save.');
        return;
      }

      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: Date.now(),
        data: JSON.parse(JSON.stringify(memoData))
      };
      
      // Keep up to 150 items to support audit log searches
      let updatedHistory = [newItem, ...history].slice(0, 150);
      
      const trySave = (items: HistoryItem[]): boolean => {
        try {
          localStorage.setItem('it-memo-history', JSON.stringify(items));
          setHistory(items);
          return true;
        } catch (e) {
          if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            if (items.length > 1) {
              // Prune oldest item and try again
              return trySave(items.slice(0, -1));
            }
          }
          throw e;
        }
      };

      trySave(updatedHistory);
    } catch (e) {
      console.error('Failed to save to history', e);
    }
  };

  const deleteHistoryItem = (id: string) => {
    try {
      const updatedHistory = history.filter(item => item.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('it-memo-history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to delete history item', e);
    }
  };

  const exportHistoryToCSV = () => {
    if (history.length === 0) {
      showToast('Nenhum log para exportar!', 'error');
      return;
    }

    try {
      // CSV Headers using semicolon separator for Latin/Excel compatibility
      let csvContent = 'Data do Registro;Número da GMUD;Tipo de Janela;Sistemas Impactados;Data de Início;Hora de Início;Data de Término;Hora de Término;Duração da Janela;Título do Comunicado\r\n';

      history.forEach((item) => {
        const registrationDate = new Date(item.timestamp).toLocaleString('pt-BR');
        const title = item.data.customTitlePt || 'Parada Programada';
        
        (item.data.windows || []).forEach((w) => {
          const gmud = w.type === 'communication' ? 'N/A (Comunicação)' : (w.gmud || 'Sem GMUD');
          const typeStr = w.type === 'communication' ? 'Apenas Comunicação' : 'Parada de Sistema';
          const systems = (w.systems || []).join(', ');
          const startDate = w.startDate || '';
          const startTime = w.startTime || '';
          const endDate = w.endDate || startDate;
          const endTime = w.endTime || '';
          const duration = calculateWindowDuration(w);

          // Escape values to avoid CSV breakage
          const escapedTitle = title.replace(/"/g, '""');
          const escapedSystems = systems.replace(/"/g, '""');

          csvContent += `"${registrationDate}";"${gmud}";"${typeStr}";"${escapedSystems}";"${startDate}";"${startTime}";"${endDate}";"${endTime}";"${duration}";"${escapedTitle}"\r\n`;
        });
      });

      // UTF-8 with BOM for proper Excel encoding
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `log_comunicados_auditoria_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Logs de auditoria exportados com sucesso em CSV!');
    } catch (e) {
      console.error('Failed to export CSV', e);
      showToast('Erro ao exportar logs em CSV.', 'error');
    }
  };

  const applyHistoryItem = (item: HistoryItem) => {
    if (item && item.data) {
      setData(item.data);
      setActiveTemplate(null);
      setActiveSection('editor');
      showToast('Histórico aplicado com sucesso!');
    }
  };

  const applyTemplate = (template: Template) => {
    if (template && template.data) {
      setData(prev => ({
        ...prev,
        customIntro: template.data.customIntro || INITIAL_DATA.customIntro,
        customTitlePt: template.data.customTitlePt || INITIAL_DATA.customTitlePt,
        windows: (template.data.windows || []).map((w: any) => ({ 
          ...w, 
          id: Math.random().toString(36).substring(2, 11),
          systems: Array.isArray(w.systems) ? w.systems : []
        }))
      }));
      setActiveTemplate(template);
      setActiveSection('editor');
      showToast('Modelo aplicado com sucesso!');
    }
  };

  const saveTemplates = (updatedTemplates: Template[]) => {
    try {
      setTemplates(updatedTemplates);
      localStorage.setItem('it-memo-templates', JSON.stringify(updatedTemplates));
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        showToast('Espaço de armazenamento cheio. Tente excluir itens do histórico.', 'error');
      } else {
        console.error('Failed to save templates', e);
        showToast('Erro ao salvar modelos.', 'error');
      }
    }
  };

  const handleSaveTemplate = (templateData: Omit<Template, 'id'> & { id?: string }) => {
    let updated;
    if (templateData.id) {
      updated = templates.map(t => t.id === templateData.id ? (templateData as Template) : t);
    } else {
      const newTemplate: Template = {
        ...templateData,
        id: Math.random().toString(36).substring(2, 11)
      } as Template;
      updated = [...templates, newTemplate];
    }
    saveTemplates(updated);
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);
    showToast('Modelo salvo com sucesso!');
  };

  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    saveTemplates(updated);
    setTemplateToDelete(null);
    showToast('Modelo excluído.');
  };

  const updateSettings = (updates: Partial<MemoSettings>) => {
    setData(prev => {
      const newSettings = { ...prev.settings, ...updates };
      try {
        localStorage.setItem('it-memo-settings', JSON.stringify(newSettings));
      } catch (e) {
        console.error('Failed to save settings', e);
      }
      return {
        ...prev,
        settings: newSettings
      };
    });
  };

  const addWindow = () => {
    const newWindow: MaintenanceWindow = {
      id: Math.random().toString(36).substr(2, 9),
      systems: [],
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      type: 'outage'
    };
    setData(prev => ({ ...prev, windows: [...prev.windows, newWindow] }));
  };

  const removeWindow = (id: string) => {
    if (data.windows.length <= 1) return;
    setData(prev => ({ ...prev, windows: prev.windows.filter(w => w.id !== id) }));
  };

  const updateWindow = (id: string, updates: Partial<MaintenanceWindow>) => {
    setData(prev => ({
      ...prev,
      windows: prev.windows.map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  };

  const toggleSystem = (windowId: string, system: System) => {
    setData(prev => ({
      ...prev,
      windows: prev.windows.map(w => {
        if (w.id !== windowId) return w;
        return {
          ...w,
          systems: w.systems.includes(system)
            ? w.systems.filter(s => s !== system)
            : [...w.systems, system]
        };
      })
    }));
  };

  const handleReset = () => {
    setData(INITIAL_DATA);
    setActiveTemplate(null);
  };

  const dataRef = useRef(data);
  const autoTranslateRef = useRef(autoTranslate);
  const isTranslatingRef = useRef(isTranslating);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { autoTranslateRef.current = autoTranslate; }, [autoTranslate]);
  useEffect(() => { isTranslatingRef.current = isTranslating; }, [isTranslating]);

  const handleGenerateTranslations = useCallback(async (retryCount = 0, force = false) => {
    const currentData = dataRef.current;
    if (currentData.windows.every(w => w.systems.length === 0)) return;
    
    const hasEmptyGmud = currentData.windows.some(w => (w.type !== 'communication') && (!w.gmud || !w.gmud.trim()));
    if (hasEmptyGmud) {
      if (force) showToast("Por favor, preencha o número da GMUD em todas as janelas de parada de sistema para habilitar a tradução!", "error");
      return;
    }

    if (!autoTranslateRef.current && !force) return;
    
    // Create a unique key for the current content to avoid redundant calls
    const currentDataKey = JSON.stringify({
      windows: currentData.windows,
      customIntro: currentData.customIntro || INITIAL_DATA.customIntro,
      customTitlePt: currentData.customTitlePt || INITIAL_DATA.customTitlePt,
      customPrompt: currentData.settings.customPrompt,
      googleApiKey: currentData.settings.googleApiKey,
      openaiApiKey: currentData.settings.openaiApiKey
    });
    
    if (currentDataKey === lastTranslatedDataRef.current && !force) return;
    if (isTranslatingRef.current && retryCount === 0) return;

    setIsTranslating(true);
    try {
      const prompt = `
        ${currentData.settings.customPrompt || DEFAULT_PROMPT}

        CRITICAL INSTRUCTION FOR THE "systems" FIELD:
        - The "systems" field in the translated result MUST strictly contain ONLY the translated or original system names (e.g., "SGBOM", "Protheus", "Fluig").
        - Under no circumstances should you append any GMUD numbers or references like "(GMUD 1840)" or "GMUD: 1840" to the systems field. Keep the systems field perfectly clean.

        Data to translate:
        Title: "${currentData.customTitlePt || INITIAL_DATA.customTitlePt}"
        Intro: "${currentData.customIntro || INITIAL_DATA.customIntro}"
        Warning: "Durante este período, os serviços listados poderão apresentar instabilidade. Recomendamos salvar todos os trabalhos antes do início."
        
        Maintenance Windows:
        ${currentData.windows.map((w, i) => `
        Window ${i + 1}:
        Systems: ${(w.systems || []).join('/')}
        GMUD: ${w.gmud || ''}
        Start Date: ${w.startDate}
        End Date: ${w.endDate}
        Time: from ${w.startTime} to ${w.endTime}
        Include Standard Text: ${w.showStandardText !== false}
        Additional Info: ${w.additionalText || ''}
        `).join('\n')}
      `;

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentData, prompt })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status} na tradução`);
      }

      const result = await response.json();

      if (result) {
        // Sanitize translated system names to remove any accidental GMUD repetitions
        if (result.en && Array.isArray(result.en.windows)) {
          result.en.windows = result.en.windows.map((w: any) => ({
            ...w,
            systems: w.systems ? w.systems.replace(/\s*\(?GMUD\s*[:\-\d\s]*\)?/gi, '').trim() : ''
          }));
        }
        if (result.zh && Array.isArray(result.zh.windows)) {
          result.zh.windows = result.zh.windows.map((w: any) => ({
            ...w,
            systems: w.systems ? w.systems.replace(/\s*\(?GMUD\s*[:\-\d\s]*\)?/gi, '').trim() : ''
          }));
        }

        setTranslations(result);
        lastTranslatedDataRef.current = currentDataKey;
        if (force) showToast("Tradução concluída com sucesso!");
      }
    } catch (error: any) {
      console.error("Translation failed:", error);
      
      const errorMsg = error?.message || String(error);
      
      // Handle rate limit error (429) with exponential backoff
      if (errorMsg.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
          console.log(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
          setTimeout(() => handleGenerateTranslations(retryCount + 1), delay);
          return; // Don't set isTranslating to false yet
        }
        showToast("Limite de requisições atingido. Tente novamente em instantes.", "error");
      } else {
        showToast(errorMsg || "Falha na tradução. Verifique suas chaves de API nas configurações.", "error");
      }
    } finally {
      if (retryCount === 0 || retryCount >= 3) {
        setIsTranslating(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleGenerateTranslations();
    }, 1500);
    return () => clearTimeout(timer);
  }, [handleGenerateTranslations]);

  const toggleAutoTranslate = () => {
    const newValue = !autoTranslate;
    setAutoTranslate(newValue);
    localStorage.setItem('it-memo-auto-translate', String(newValue));
    if (newValue) {
      handleGenerateTranslations(0, true);
    }
  };

  const handleGenerate = () => {
    const hasEmptyGmud = data.windows.some(w => (w.type !== 'communication') && (!w.gmud || !w.gmud.trim()));
    if (hasEmptyGmud) {
      showToast('Por favor, preencha o número da GMUD em todas as janelas de parada de sistema!', 'error');
      return;
    }
    setIsGenerating(true);
    saveToHistory(data);
    setTimeout(() => {
      setIsGenerating(false);
      setHasGeneratedCurrent(true);
      // Optional: auto-download or show success
    }, 1500);
  };

  const handleCopyText = async () => {
    const hasEmptyGmud = data.windows.some(w => (w.type !== 'communication') && (!w.gmud || !w.gmud.trim()));
    if (hasEmptyGmud) {
      showToast('Por favor, preencha o número da GMUD em todas as janelas de parada de sistema!', 'error');
      return;
    }
    let text = `
COMUNICADO DE MANUTENÇÃO PROGRAMADA
-----------------------------------
Prezados colaboradores,

${data.customIntro || INITIAL_DATA.customIntro}

JANELAS DE MANUTENÇÃO:
${(data.windows || []).map(w => `
- SISTEMAS: ${(w.systems || []).join('/')}
  DATA: ${formatDateLong(w.startDate)} (${getDayOfWeek(w.startDate)})
  HORÁRIO: das ${w.startTime}h às ${w.endTime}h${w.startDate !== w.endDate ? ` do dia ${formatDateLong(w.endDate)}` : ''}
`).join('')}

Atenciosamente,
TI
`.trim();

    if (translations) {
      text += `

${translations.en.title}

Dear colleagues,
${translations.en.intro}

MAINTENANCE WINDOWS:
${Array.isArray(translations.en.windows) ? translations.en.windows.map((w, idx) => `
- SYSTEMS: ${w.systems}
  ${w.text}
`).join('') : ''}

${translations.zh.title}

各位同事：
${translations.zh.intro}

维护窗口：
${Array.isArray(translations.zh.windows) ? translations.zh.windows.map((w, idx) => `
- 系统: ${w.systems}
  ${w.text}
`).join('') : ''}
`;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('Texto copiado para a área de transferência!');
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
      showToast('Erro ao copiar texto. Tente manualmente.', 'error');
    }
  };

  const handleDownloadImage = async () => {
    if (!hasGeneratedCurrent) {
      showToast('Por favor, clique em "Gerar Comunicado" primeiro para habilitar o download!', 'error');
      return;
    }
    if (!previewRef.current) return;
    
    const hasEmptyGmud = data.windows.some(w => (w.type !== 'communication') && (!w.gmud || !w.gmud.trim()));
    if (hasEmptyGmud) {
      showToast('Por favor, preencha o número da GMUD em todas as janelas de parada de sistema antes de baixar a imagem!', 'error');
      return;
    }
    
    setIsGenerating(true);
    
    // Store original styles to restore later
    const originalWidth = previewRef.current.style.width;
    const originalHeight = previewRef.current.style.height;
    const originalMinHeight = previewRef.current.style.minHeight;
    const originalMaxHeight = previewRef.current.style.maxHeight;
    const originalPosition = previewRef.current.style.position;
    const originalOverflow = previewRef.current.style.overflow;
    const originalMargin = previewRef.current.style.margin;
    const originalPadding = previewRef.current.style.padding;
    const originalTransform = previewRef.current.style.transform;
    const originalBoxShadow = previewRef.current.style.boxShadow;
    const originalBorderRadius = previewRef.current.style.borderRadius;
    
    try {
      // 1. Prepare for high-quality capture
      const captureWidth = 1228; // 1180px content + 48px padding (24px each side)
      
      // Ensure the element is clean for capture
      previewRef.current.style.width = `${captureWidth}px`;
      previewRef.current.style.height = 'auto';
      previewRef.current.style.minHeight = 'unset';
      previewRef.current.style.maxHeight = 'unset';
      previewRef.current.style.overflow = 'visible';
      previewRef.current.style.margin = '0';
      previewRef.current.style.padding = '24px'; // Match the p-6 class (24px)
      previewRef.current.style.transform = 'none';
      previewRef.current.style.boxShadow = 'none';
      previewRef.current.style.borderRadius = '0';
      
      // 2. Wait for layout to settle and images to be ready
      // Increased delay to ensure all images and fonts are rendered
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 3. Measure the actual content height accurately
      // We use offsetHeight as it includes padding and borders
      const captureHeight = previewRef.current.offsetHeight;

      // 4. Generate the image with html-to-image
      const dataUrl = await htmlToImage.toPng(previewRef.current, {
        quality: 1,
        pixelRatio: 3, // Even higher resolution (3x)
        width: captureWidth,
        height: captureHeight,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'none',
          width: `${captureWidth}px`,
          height: `${captureHeight}px`,
          borderRadius: '0', 
          boxShadow: 'none',
          margin: '0',
          padding: '24px', 
          backdropFilter: 'none', 
        }
      });
      
      const link = document.createElement('a');
      link.download = `comunicado-ti-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
      showToast('Imagem baixada com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      showToast('Erro ao gerar imagem. Tente novamente.', 'error');
    } finally {
      // Restore original styles
      if (previewRef.current) {
        previewRef.current.style.width = originalWidth;
        previewRef.current.style.height = originalHeight;
        previewRef.current.style.minHeight = originalMinHeight;
        previewRef.current.style.maxHeight = originalMaxHeight;
        previewRef.current.style.position = originalPosition;
        previewRef.current.style.overflow = originalOverflow;
        previewRef.current.style.margin = originalMargin;
        previewRef.current.style.padding = originalPadding;
        previewRef.current.style.transform = originalTransform;
        previewRef.current.style.boxShadow = originalBoxShadow;
        previewRef.current.style.borderRadius = originalBorderRadius;
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-outline-variant/20 bg-slate-50 shrink-0 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 relative">
                <Image 
                  src="https://picsum.photos/seed/admin/100/100" 
                  alt="Profile" 
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <p className="font-headline font-bold text-primary leading-tight">IT MEMO</p>
                <p className="text-[12px] text-on-surface-variant uppercase tracking-wider font-medium">Architect Suite</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant"
            >
              <X size={20} />
            </button>
          </div>
          
          <button 
            onClick={() => {
              handleReset();
              setIsSidebarOpen(false);
            }}
            className="w-full py-3 bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold text-[16px] rounded-lg shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={16} />
            Novo Comunicado
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          <NavItem 
            icon={<Edit3 size={18} />} 
            label="Gerador" 
            active={activeSection === 'editor'} 
            onClick={() => {
              setActiveSection('editor');
              setIsSidebarOpen(false);
            }}
          />
          <NavItem 
            icon={<FileText size={18} />} 
            label="Modelos" 
            active={activeSection === 'templates'} 
            onClick={() => {
              setActiveSection('templates');
              setIsSidebarOpen(false);
            }}
          />
          <NavItem 
            icon={<History size={18} />} 
            label="Logs & Auditoria" 
            active={activeSection === 'history'} 
            onClick={() => {
              setActiveSection('history');
              setIsSidebarOpen(false);
            }}
          />
          <NavItem 
            icon={<Settings size={18} />} 
            label="Configurações" 
            active={activeSection === 'settings'} 
            onClick={() => {
              setActiveSection('settings');
              setIsSidebarOpen(false);
            }}
          />
        </nav>

        <div className="p-6 border-t border-outline-variant/10">
          <p className="text-[13px] font-bold text-on-surface-variant/50 uppercase tracking-widest">© 2024 IT ARCHITECT</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-18 border-b border-outline-variant/10 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant"
            >
              <Layout size={20} />
            </button>
            <span className="text-[22px] font-black text-primary tracking-tighter font-headline lg:hidden">IT MEMO</span>
            <div className="hidden lg:block h-6 w-px bg-outline-variant/30"></div>
            <h1 className="text-[18px] lg:text-[21px] font-bold font-headline text-on-surface tracking-tight truncate max-w-[200px] sm:max-w-none">
              Gerador de Comunicado
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant">
              <HelpCircle size={20} />
            </button>
            <button 
              onClick={() => setActiveSection('settings')}
              className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Form Panel */}
          <section className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 bg-surface">
            <div className="max-w-xl mx-auto lg:mx-0">
              <AnimatePresence mode="wait">
                {activeSection === 'editor' && (
                  <motion.div
                    key="editor"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-10"
                  >
                    <header className="mb-10">
                      {activeTemplate && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[13px] font-bold uppercase tracking-wider mb-4 border border-primary/20">
                          <Layout size={20} />
                          Modelo Ativo: {activeTemplate.title}
                        </div>
                      )}
                      <h2 className="text-[31px] font-headline font-extrabold text-primary tracking-tight mb-2">Configurar Comunicado</h2>
                      <p className="text-on-surface-variant text-[16px]">Preencha as informações técnicas para gerar o informativo de manutenção.</p>
                    </header>

                    <div className="space-y-12">
                      {/* Custom Intro Editor */}
                      <div className="p-6 bg-primary/5 rounded-xl border border-primary/10">
                        <div className="flex justify-between items-center mb-3">
                          <label className="block text-primary font-bold text-[11px] uppercase tracking-[0.2em]">Texto de Introdução (Padrão)</label>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-on-surface-variant/60 uppercase">Tradução Automática</span>
                              <button 
                                onClick={toggleAutoTranslate}
                                className={`w-8 h-4 rounded-full relative transition-colors ${autoTranslate ? 'bg-primary' : 'bg-outline-variant/30'}`}
                              >
                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoTranslate ? 'left-4.5' : 'left-0.5'}`} />
                              </button>
                            </div>
                            {!autoTranslate && (
                              <button 
                                onClick={() => handleGenerateTranslations(0, true)}
                                disabled={isTranslating}
                                className="flex items-center gap-1 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-[11px] font-bold uppercase transition-colors disabled:opacity-50"
                              >
                                <Sparkles size={10} />
                                {isTranslating ? 'Traduzindo...' : 'Traduzir Agora'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="space-y-2">
                            <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">Título do Comunicado (Português)</label>
                            <input 
                              type="text"
                              value={data.customTitlePt}
                              onChange={(e) => setData(prev => ({ ...prev, customTitlePt: e.target.value }))}
                              className="w-full p-3 bg-white border border-outline-variant/10 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                              placeholder="Parada Programada"
                            />
                          </div>
                        </div>
                        <textarea 
                          value={data.customIntro}
                          onChange={(e) => setData(prev => ({ ...prev, customIntro: e.target.value }))}
                          className="w-full p-4 bg-white border border-outline-variant/10 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none min-h-[100px] leading-relaxed"
                          placeholder="Digite o texto de introdução do comunicado..."
                        />
                        <p className="text-[11px] text-on-surface-variant/60 mt-2 italic">
                          {autoTranslate 
                            ? "Este texto será traduzido automaticamente para Inglês e Chinês." 
                            : "A tradução automática está desativada. Use o botão acima para traduzir manualmente."}
                        </p>
                      </div>

                      {data.windows.map((window, index) => (
                        <div key={window.id} className="p-6 bg-surface-container-low/30 rounded-xl border border-outline-variant/10 relative group/window">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-primary font-bold text-[12px] uppercase tracking-[0.2em]">Janela de Manutenção #{index + 1}</h3>
                            {data.windows.length > 1 && (
                              <button 
                                onClick={() => removeWindow(window.id)}
                                className="text-tertiary hover:bg-tertiary/10 p-1 rounded-full transition-colors"
                              >
                                <RotateCcw size={14} className="rotate-45" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-8">
                            {/* Systems */}
                            <div>
                              <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-3">Sistemas Impactados</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                {systemOptions.map(sys => (
                                  <div
                                    key={sys}
                                    className="group/sys relative flex items-center"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleSystem(window.id, sys)}
                                      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-sm transition-all text-left border ${
                                        window.systems.includes(sys)
                                          ? 'bg-primary/5 border-primary/20 text-primary'
                                          : 'bg-white border-transparent hover:bg-surface-container-high text-on-surface-variant'
                                      }`}
                                    >
                                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${
                                        window.systems.includes(sys) ? 'bg-primary border-primary' : 'bg-white border-outline-variant'
                                      }`}>
                                        {window.systems.includes(sys) && <Check size={10} className="text-white" />}
                                      </div>
                                      <span className="text-[14px] font-medium pr-6 truncate">{sys}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveSystem(sys);
                                      }}
                                      className="absolute right-2 opacity-0 group-hover/sys:opacity-100 hover:text-tertiary transition-opacity p-1.5 rounded-full hover:bg-black/5 text-on-surface-variant/40"
                                      title="Excluir sistema"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {/* Adicionar novo sistema */}
                              <div className="flex gap-2 max-w-sm mt-3">
                                <input
                                  type="text"
                                  placeholder="Novo sistema..."
                                  value={newSystemName}
                                  onChange={(e) => setNewSystemName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSystem();
                                    }
                                  }}
                                  className="flex-grow px-3 py-1.5 bg-white border border-outline-variant/10 rounded-sm text-[13px] font-medium outline-none focus:ring-1 focus:ring-primary/20"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddSystem}
                                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[13px] rounded-sm transition-all flex items-center gap-1 shrink-0"
                                >
                                  <Plus size={14} />
                                  Adicionar
                                </button>
                              </div>
                            </div>

                            {/* Date & Time */}
                            <div className="grid gap-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2">Data de Início</label>
                                  <div className="relative group">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={16} />
                                    <input 
                                      type="date"
                                      value={window.startDate}
                                      onChange={(e) => updateWindow(window.id, { startDate: e.target.value, endDate: window.endDate || e.target.value })}
                                      className="w-full pl-10 pr-4 py-2 bg-white border-none rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2">Data de Término</label>
                                  <div className="relative group">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={16} />
                                    <input 
                                      type="date"
                                      value={window.endDate}
                                      onChange={(e) => updateWindow(window.id, { endDate: e.target.value })}
                                      className="w-full pl-10 pr-4 py-2 bg-white border-none rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2">Hora de Início</label>
                                  <div className="relative group">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={16} />
                                    <input 
                                      type="time"
                                      value={window.startTime}
                                      onChange={(e) => updateWindow(window.id, { startTime: e.target.value })}
                                      className="w-full pl-10 pr-4 py-2 bg-white border-none rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2">Hora de Término</label>
                                  <div className="relative group">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={16} />
                                    <input 
                                      type="time"
                                      value={window.endTime}
                                      onChange={(e) => updateWindow(window.id, { endTime: e.target.value })}
                                      className="w-full pl-10 pr-4 py-2 bg-white border-none rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Tipo de Janela: Parada de Sistema vs Apenas Comunicação */}
                              <div>
                                <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2">Tipo de Janela</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateWindow(window.id, { type: 'outage' })}
                                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-sm text-[13px] font-bold border transition-all ${
                                      (window.type === undefined || window.type === 'outage')
                                        ? 'bg-primary/5 border-primary/20 text-primary'
                                        : 'bg-white border-transparent hover:bg-surface-container-high text-on-surface-variant'
                                    }`}
                                  >
                                    <Layout size={14} />
                                    Parada de Sistema
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateWindow(window.id, { type: 'communication' })}
                                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-sm text-[13px] font-bold border transition-all ${
                                      window.type === 'communication'
                                        ? 'bg-primary/5 border-primary/20 text-primary'
                                        : 'bg-white border-transparent hover:bg-surface-container-high text-on-surface-variant'
                                    }`}
                                  >
                                    <FileText size={14} />
                                    Apenas Comunicação
                                  </button>
                                </div>
                              </div>

                              {/* Número da GMUD */}
                              <div>
                                <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2 flex items-center gap-1">
                                  Número da GMUD{' '}
                                  {window.type !== 'communication' ? (
                                    <span className="text-tertiary font-bold text-[13px] leading-none" title="Obrigatório">*</span>
                                  ) : (
                                    <span className="text-on-surface-variant/50 font-normal text-[10px] lowercase tracking-normal">(Opcional)</span>
                                  )}
                                </label>
                                <div className="relative group">
                                  <FileText className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${((window.type !== 'communication') && (!window.gmud || !window.gmud.trim())) ? 'text-tertiary' : 'text-on-surface-variant group-focus-within:text-primary'}`} size={16} />
                                  <input 
                                    type="text"
                                    placeholder="Ex: GMUD-12345"
                                    value={window.gmud || ''}
                                    required={window.type !== 'communication'}
                                    onChange={(e) => updateWindow(window.id, { gmud: e.target.value })}
                                    className={`w-full pl-10 pr-4 py-2 bg-white rounded-sm transition-all text-[14px] font-medium outline-none border ${
                                      ((window.type !== 'communication') && (!window.gmud || !window.gmud.trim()))
                                        ? 'border-tertiary/40 focus:ring-1 focus:ring-tertiary/20'
                                        : 'border-transparent focus:ring-1 focus:ring-primary/20'
                                    }`}
                                  />
                                </div>
                                {((window.type !== 'communication') && (!window.gmud || !window.gmud.trim())) && (
                                  <span className="text-[11px] text-tertiary font-semibold mt-1.5 block">
                                    Este campo é obrigatório
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mb-4 cursor-pointer select-none" onClick={() => updateWindow(window.id, { showStandardText: window.showStandardText !== false ? false : true })}>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${window.showStandardText !== false ? 'bg-primary' : 'bg-outline-variant/30'}`}>
                                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${window.showStandardText !== false ? 'left-4.5' : 'left-0.5'}`} />
                                </div>
                                <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Incluir texto padrão</span>
                              </div>

                              {/* Additional Info */}
                              <div>
                                <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em] mb-2">Detalhes Adicionais (Opcional)</label>
                                <textarea
                                  value={window.additionalText || ''}
                                  onChange={(e) => updateWindow(window.id, { additionalText: e.target.value })}
                                  placeholder="Ex: Atualização do banco de dados, Reboot do servidor..."
                                  className="w-full px-4 py-3 bg-white border-none rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none h-20 resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        onClick={addWindow}
                        className="w-full py-4 border-2 border-dashed border-outline-variant/30 rounded-xl text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2 text-[14px] font-bold"
                      >
                        <Plus size={16} />
                        Adicionar Outra Janela
                      </button>

                      {/* Info Box */}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10"
                      >
                        <div className="text-primary shrink-0 mt-0.5">
                          <Info size={18} />
                        </div>
                        <p className="text-[14px] text-on-surface-variant leading-relaxed">
                          As alterações feitas aqui são refletidas em tempo real na pré-visualização ao lado. 
                          Certifique-se de validar todos os sistemas impactados antes de gerar o PDF final.
                        </p>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {activeSection === 'templates' && (
                  <motion.div
                    key="templates"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-8 max-w-4xl"
                  >
                    <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                      <div>
                        <h2 className="text-[32px] font-headline font-extrabold text-[#004d40] tracking-tight mb-1.5">
                          Modelos Prontos
                        </h2>
                        <p className="text-slate-600 text-[15px] max-w-xl leading-relaxed">
                          Escolha um modelo para começar rapidamente ou gerencie seus próprios.
                        </p>
                      </div>

                      <button 
                        onClick={() => {
                          setEditingTemplate(null);
                          setIsTemplateModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#005a4e] hover:bg-[#004d40] text-white rounded-xl font-headline font-bold text-[14px] transition-all shadow-md shadow-[#005a4e]/20 active:scale-95 shrink-0 self-start sm:self-auto"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                        <span>Novo Modelo</span>
                      </button>
                    </header>

                    <div className="space-y-4">
                      {templates.map((template) => (
                        <div key={template.id} className="relative group/template">
                          <button
                            onClick={() => applyTemplate(template)}
                            className="w-full flex items-start sm:items-center gap-4 p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl hover:border-[#005a4e]/30 hover:shadow-xl hover:shadow-[#005a4e]/5 transition-all text-left group"
                          >
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#e6f4f1] flex items-center justify-center text-[#005a4e] shrink-0 group-hover:bg-[#005a4e] group-hover:text-white transition-all">
                              {ICON_MAP[template.iconType] || <Sparkles size={22} />}
                            </div>

                            <div className="flex-1 min-w-0 pr-8 sm:pr-12">
                              <h3 className="font-headline font-bold text-slate-900 text-[17px] sm:text-[18px]">
                                {template.title}
                              </h3>
                              <p className="text-slate-500 text-[13.5px] sm:text-[14px] mt-1 leading-relaxed line-clamp-2">
                                {template.description}
                              </p>
                              {template.data.customIntro && (
                                <div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#005a4e]">
                                  <Sparkles size={13} className="text-[#005a4e]" />
                                  <span>Possui texto padrão personalizado</span>
                                </div>
                              )}
                            </div>

                            <ChevronRight className="ml-auto text-slate-300 group-hover:text-[#005a4e] group-hover:translate-x-1 transition-all shrink-0" size={20} />
                          </button>

                          <div className="absolute top-4 right-10 sm:right-12 flex items-center gap-1 opacity-0 group-hover/template:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTemplate(template);
                                setIsTemplateModalOpen(true);
                              }}
                              className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-[#005a4e] hover:bg-slate-50 rounded-lg shadow-sm transition-all"
                              title="Editar Modelo"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                              }}
                              className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-slate-50 rounded-lg shadow-sm transition-all"
                              title="Excluir Modelo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeSection === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                  >
                    <header className="mb-10">
                      <h2 className="text-[31px] font-headline font-extrabold text-primary tracking-tight mb-2">Configurações</h2>
                      <p className="text-on-surface-variant text-[16px]">Personalize as informações do rodapé e identidade.</p>
                    </header>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">Imagem do Cabeçalho</label>
                            {data.settings.headerImage && (
                              <button 
                                onClick={() => updateSettings({ headerImage: '' })}
                                className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <div className="relative group h-24 bg-white border border-outline-variant/10 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/30 transition-all">
                            {isUploadingHeader ? (
                              <div className="flex flex-col items-center gap-1">
                                <RotateCcw className="text-primary animate-spin" size={24} />
                                <span className="text-[11px] text-primary font-bold uppercase">Processando...</span>
                              </div>
                            ) : data.settings.headerImage ? (
                              <div className="relative w-full h-full">
                                <Image 
                                  src={data.settings.headerImage} 
                                  alt="Header Preview" 
                                  fill
                                  className="object-cover"
                                  onError={() => {
                                    updateSettings({ headerImage: '' });
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <ImageIcon className="text-on-surface-variant/30" size={24} />
                                <span className="text-[11px] text-on-surface-variant/50 font-bold uppercase">Carregar</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                              <span className="text-white text-[11px] font-bold uppercase">Alterar</span>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*"
                              disabled={isUploadingHeader}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setIsUploadingHeader(true);
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    try {
                                      const compressed = await compressImage(reader.result as string);
                                      updateSettings({ headerImage: compressed });
                                    } catch (err) {
                                      console.error("Compression failed", err);
                                      showToast("Erro ao processar imagem", "error");
                                    } finally {
                                      setIsUploadingHeader(false);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">Imagem do Rodapé (Opcional)</label>
                            {data.settings.footerImage && (
                              <button 
                                onClick={() => updateSettings({ footerImage: '' })}
                                className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <div className="relative group h-24 bg-white border border-outline-variant/10 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/30 transition-all">
                            {isUploadingFooter ? (
                              <div className="flex flex-col items-center gap-1">
                                <RotateCcw className="text-primary animate-spin" size={24} />
                                <span className="text-[11px] text-primary font-bold uppercase">Processando...</span>
                              </div>
                            ) : data.settings.footerImage ? (
                              <div className="relative w-full h-full">
                                <Image 
                                  src={data.settings.footerImage} 
                                  alt="Footer Preview" 
                                  fill
                                  className="object-cover"
                                  onError={() => {
                                    updateSettings({ footerImage: '' });
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <ImageIcon className="text-on-surface-variant/30" size={24} />
                                <span className="text-[11px] text-on-surface-variant/50 font-bold uppercase">Carregar</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                              <span className="text-white text-[11px] font-bold uppercase">Alterar</span>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*"
                              disabled={isUploadingFooter}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setIsUploadingFooter(true);
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    try {
                                      const compressed = await compressImage(reader.result as string);
                                      updateSettings({ footerImage: compressed });
                                    } catch (err) {
                                      console.error("Compression failed", err);
                                      showToast("Erro ao processar imagem", "error");
                                    } finally {
                                      setIsUploadingFooter(false);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">Google Gemini API Key (Opcional)</label>
                          <input 
                            type="password" 
                            value={data.settings.googleApiKey || ''}
                            onChange={(e) => updateSettings({ googleApiKey: e.target.value })}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-2 bg-white border border-outline-variant/10 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                          />
                          <p className="text-[11px] text-on-surface-variant/60">
                            Chave do Google Gemini. Se vazia, utiliza a chave configurada no servidor.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">ChatGPT API Key (Opcional)</label>
                          <input 
                            type="password" 
                            value={data.settings.openaiApiKey || ''}
                            onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                            placeholder="sk-..."
                            className="w-full px-4 py-2 bg-white border border-outline-variant/10 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                          />
                          <p className="text-[11px] text-on-surface-variant/60">
                            Caso prefira utilizar a API da OpenAI para traduções.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">Departamento</label>
                        <input 
                          type="text" 
                          value={data.settings.department}
                          onChange={(e) => updateSettings({ department: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-outline-variant/10 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-on-surface-variant font-bold text-[11px] uppercase tracking-[0.1em]">Prompt de Tradução (IA)</label>
                        <textarea 
                          value={data.settings.customPrompt || DEFAULT_PROMPT}
                          onChange={(e) => updateSettings({ customPrompt: e.target.value })}
                          rows={8}
                          className="w-full px-4 py-3 bg-white border border-outline-variant/10 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all text-[14px] font-medium outline-none font-mono leading-relaxed"
                        />
                        <p className="text-[12px] text-on-surface-variant/60">
                          Edite as instruções enviadas para a IA. O conteúdo do memorando será anexado automaticamente ao final deste prompt.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeSection === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <header className="mb-6">
                      <h2 className="text-[31px] font-headline font-extrabold text-primary tracking-tight mb-2 font-bold text-primary">Logs & Auditoria</h2>
                      <p className="text-on-surface-variant text-[16px]">Consulte o registro histórico de janelas, sistemas e GMUDs para suporte a auditorias.</p>
                    </header>

                    {/* KPI Dashboard */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-slate-50 border border-outline-variant/10 rounded-2xl flex flex-col justify-center shadow-sm">
                        <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-[0.15em]">Total Registrado</span>
                        <span className="text-[24px] font-extrabold text-primary font-headline mt-1 font-black">{history.length}</span>
                      </div>
                      <div className="p-4 bg-slate-50 border border-outline-variant/10 rounded-2xl flex flex-col justify-center shadow-sm">
                        <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-[0.15em]">Paradas de Sistema</span>
                        <span className="text-[24px] font-extrabold text-primary font-headline mt-1 font-black">
                          {history.filter(item => item.data.windows?.some(w => w.type !== 'communication')).length}
                        </span>
                      </div>
                      <div className="p-4 bg-slate-50 border border-outline-variant/10 rounded-2xl flex flex-col justify-center shadow-sm">
                        <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-[0.15em]">Apenas Comunicações</span>
                        <span className="text-[24px] font-extrabold text-primary font-headline mt-1 font-black font-semibold">
                          {history.filter(item => item.data.windows?.some(w => w.type === 'communication')).length}
                        </span>
                      </div>
                    </div>

                    {/* Search & Action Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-4 border-b border-outline-variant/10">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                        <input
                          type="text"
                          value={historySearchQuery}
                          onChange={(e) => setHistorySearchQuery(e.target.value)}
                          placeholder="Buscar por GMUD, sistema, data, título..."
                          className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-outline-variant/10 rounded-xl text-[14px] font-medium outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                        />
                        {historySearchQuery && (
                          <button
                            onClick={() => setHistorySearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface text-[11px] font-bold uppercase tracking-wider"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={historyFilterType}
                          onChange={(e: any) => setHistoryFilterType(e.target.value)}
                          className="px-3 py-2 bg-slate-50 border border-outline-variant/10 rounded-xl text-[13px] font-bold text-on-surface-variant outline-none focus:ring-1 focus:ring-primary/20"
                        >
                          <option value="all">Todos os Tipos</option>
                          <option value="outage">Paradas de Sistema</option>
                          <option value="communication">Apenas Comunicação</option>
                        </select>
                        <button
                          onClick={exportHistoryToCSV}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[13px] font-bold rounded-xl transition-all shadow-sm"
                          title="Exportar logs para Excel"
                        >
                          <Download size={14} />
                          <span>Exportar CSV</span>
                        </button>
                      </div>
                    </div>

                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4 bg-slate-50 rounded-2xl border border-dashed border-outline-variant/20">
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-slate-300 shadow-sm">
                          <History size={32} />
                        </div>
                        <div>
                          <h3 className="font-headline font-bold text-on-surface text-[16px]">Nenhum histórico</h3>
                          <p className="text-on-surface-variant text-[15px] mt-1">Seus comunicados gerados aparecerão aqui.</p>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const filteredHistory = history.filter((item) => {
                          const query = historySearchQuery.trim().toLowerCase();
                          const matchesQuery = !query ? true : (
                            (item.data.customTitlePt || '').toLowerCase().includes(query) ||
                            (item.data.windows || []).some(w => 
                              (w.gmud || '').toLowerCase().includes(query) ||
                              (w.systems || []).some(sys => sys.toLowerCase().includes(query)) ||
                              (w.startDate || '').includes(query) ||
                              (w.endDate || '').includes(query) ||
                              (w.additionalText || '').toLowerCase().includes(query)
                            )
                          );

                          const matchesType = historyFilterType === 'all' ? true : (
                            item.data.windows.some(w => {
                              const wType = w.type || 'outage';
                              return wType === historyFilterType;
                            })
                          );

                          return matchesQuery && matchesType;
                        });

                        if (filteredHistory.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center h-[240px] text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-outline-variant/20">
                              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-slate-300 shadow-sm">
                                <Search size={20} />
                              </div>
                              <div>
                                <h4 className="font-headline font-bold text-on-surface text-[15px] font-bold">Nenhum registro encontrado</h4>
                                <p className="text-on-surface-variant text-[13px] mt-1">Nenhum log corresponde aos filtros e termos digitados.</p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {filteredHistory.map((item) => {
                              const isExpanded = expandedHistoryId === item.id;
                              return (
                                <div 
                                  key={item.id} 
                                  className={`bg-white border rounded-2xl transition-all overflow-hidden ${
                                    isExpanded ? 'border-primary/35 shadow-md shadow-primary/5' : 'border-outline-variant/10 hover:border-primary/10 shadow-sm'
                                  }`}
                                >
                                  {/* Item Summary Row */}
                                  <div 
                                    onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 cursor-pointer hover:bg-slate-50/40 transition-colors select-none"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                                        <FileText size={18} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                          <span className="text-[13px] font-bold text-primary font-headline">
                                            {new Date(item.timestamp).toLocaleString('pt-BR')}
                                          </span>
                                          <span className="text-on-surface-variant/40 text-[11px] font-medium hidden sm:inline">•</span>
                                          <span className="text-on-surface-variant text-[13px] font-medium truncate max-w-[200px] sm:max-w-none">
                                            {item.data.customTitlePt || 'Parada Programada'}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {(item.data.windows || []).map((w, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-sm border border-outline-variant/5">
                                              <span className="text-[12px] font-bold text-on-surface">
                                                {(w.systems || []).join('/')}
                                              </span>
                                              <span className={`text-[9px] font-extrabold px-1 py-0.2 rounded-sm uppercase ${
                                                w.type === 'communication' 
                                                  ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                                  : 'bg-red-50 text-red-600 border border-red-100'
                                              }`}>
                                                {w.type === 'communication' ? 'Comunicação' : 'Parada'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-stretch sm:self-center justify-end shrink-0">
                                      <div className="flex flex-wrap items-center gap-1">
                                        {(item.data.windows || []).map((w, idx) => {
                                          if (w.type === 'communication') return null;
                                          return (
                                            <span 
                                              key={idx} 
                                              className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider"
                                            >
                                              {w.gmud || 'Sem GMUD'}
                                            </span>
                                          );
                                        })}
                                      </div>
                                      <div className="h-6 w-px bg-outline-variant/20 mx-1 hidden sm:block"></div>
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            applyHistoryItem(item);
                                          }}
                                          className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                                          title="Restaurar este comunicado como rascunho"
                                        >
                                          <RotateCcw size={15} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteHistoryItem(item.id);
                                          }}
                                          className="p-2 hover:bg-tertiary/10 text-tertiary rounded-lg transition-colors"
                                          title="Excluir do log"
                                        >
                                          <RotateCcw size={15} className="rotate-45" />
                                        </button>
                                        <ChevronRight className={`text-on-surface-variant/40 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : ''}`} size={16} />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expanded Item Audit Specs */}
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="border-t border-outline-variant/10 bg-slate-50/50 p-4 sm:p-5 space-y-4 text-[13px]"
                                    >
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Parametros de Auditoria */}
                                        <div className="space-y-3 bg-white p-4 rounded-xl border border-outline-variant/10 shadow-sm">
                                          <h4 className="text-[12px] font-bold text-primary uppercase tracking-[0.1em] border-b border-primary/10 pb-1.5 flex items-center justify-between">
                                            <span>Parâmetros de Auditoria</span>
                                            <span className="text-on-surface-variant/50 font-normal lowercase tracking-normal">({item.data.windows?.length || 0} Janela(s))</span>
                                          </h4>
                                          {(item.data.windows || []).map((w, idx) => (
                                            <div key={idx} className="space-y-1.5 text-on-surface-variant border-b border-slate-50 last:border-b-0 pb-3 last:pb-0">
                                              <p className="flex justify-between">
                                                <strong className="text-on-surface">Janela #{idx + 1}:</strong>
                                                <span className="font-bold text-primary">{(w.systems || []).join(', ')}</span>
                                              </p>
                                              <p className="flex justify-between">
                                                <span>Tipo de Janela:</span>
                                                <span className="font-medium text-on-surface">{w.type === 'communication' ? 'Apenas Comunicação' : 'Parada de Sistema'}</span>
                                              </p>
                                              <p className="flex justify-between">
                                                <span>Número da GMUD:</span>
                                                <span className="font-mono font-bold text-on-surface bg-slate-100 px-1 py-0.5 rounded text-[11px]">{w.type === 'communication' ? 'N/A' : (w.gmud || 'Não Informado')}</span>
                                              </p>
                                              <p className="flex justify-between">
                                                <span>Período:</span>
                                                <span className="font-medium text-on-surface text-right">
                                                  {formatWindowDateRange(w.startDate, w.endDate)}
                                                </span>
                                              </p>
                                              <p className="flex justify-between">
                                                <span>Horário:</span>
                                                <span className="font-medium text-on-surface">das {w.startTime} às {w.endTime}</span>
                                              </p>
                                              <p className="flex justify-between">
                                                <span>Tempo de Janela (Duração):</span>
                                                <span className="font-extrabold text-primary">{calculateWindowDuration(w)}</span>
                                              </p>
                                              {w.additionalText && (
                                                <div className="bg-slate-50 p-2 rounded mt-1.5">
                                                  <span className="text-[10px] font-bold text-on-surface-variant block uppercase tracking-wider mb-0.5">Detalhes Adicionais:</span>
                                                  <span className="text-on-surface-variant text-[12px]">{w.additionalText}</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        {/* Informações Gerais */}
                                        <div className="space-y-3 bg-white p-4 rounded-xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
                                          <div>
                                            <h4 className="text-[12px] font-bold text-primary uppercase tracking-[0.1em] border-b border-primary/10 pb-1.5">Texto de Introdução</h4>
                                            <p className="text-on-surface-variant leading-relaxed italic mt-2 text-[12.5px]">
                                              {"\""}{item.data.customIntro || 'Prezados colaboradores, gostaríamos de informar que...'}{"\""}
                                            </p>
                                          </div>
                                          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 justify-between items-center text-[11px] text-on-surface-variant/60">
                                            <div>
                                              <span>Gerente Responsável: </span>
                                              <strong className="text-on-surface">{item.data.settings?.manager || 'Não definido'}</strong>
                                            </div>
                                            <div>
                                              <span>Departamento: </span>
                                              <strong className="text-on-surface">{item.data.settings?.department || 'TI'}</strong>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Preview Panel */}
          <section className="flex-1 bg-surface-container-low p-4 sm:p-8 lg:p-12 overflow-y-auto border-t md:border-t-0 md:border-l border-outline-variant/10">
            <div className="max-w-7xl mx-auto min-h-full flex flex-col">
              <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-primary font-bold text-[13px] uppercase tracking-[0.2em]">Pré-visualização do Comunicado (Trilingue)</h2>
                  {isTranslating && (
                    <div className="flex items-center gap-2 text-[11px] text-primary animate-pulse">
                      <RotateCcw size={10} className="animate-spin" />
                      <span className="text-[11px]">Traduzindo para EN e ZH...</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Rascunho Ativo</span>
                </div>
              </header>

              {/* Memo Document - Landscape Format */}
              <div 
                ref={previewRef}
                className="w-full min-h-[540px] memo-preview-glass shadow-2xl rounded-3xl border border-white/50 flex flex-col relative bg-white p-6 gap-4"
              >
                {/* Header Box */}
                <div className="relative h-[162px] bg-primary shrink-0 overflow-hidden rounded-2xl shadow-sm">
                  {data.settings.headerImage ? (
                    <div className="relative w-full h-full">
                      <Image 
                        src={data.settings.headerImage} 
                        alt="IT Memo Header Banner" 
                        fill
                        priority
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-primary flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="text-white/40" size={32} />
                        <span className="text-white/60 text-[15px] font-bold uppercase tracking-widest">IT Maintenance Memo</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Document Body - 3 Columns */}
                <div className="flex-1 min-h-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-full">
                    {/* Portuguese Box */}
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-outline-variant/10 flex flex-col shadow-sm">
                      <div className="pb-3 border-b border-primary/10 mb-4">
                        <h5 className="text-[21px] font-headline font-bold text-on-surface leading-tight mt-1">{data.customTitlePt || 'Parada Programada'}</h5>
                      </div>
                      <div className="text-on-surface-variant text-[15px] leading-relaxed space-y-3 flex-1">
                        <p className="font-bold">Prezados colaboradores,</p>
                        <p>{data.customIntro || 'Informamos que realizaremos uma manutenção técnica essencial para garantir a estabilidade e performance de nossa infraestrutura digital.'}</p>
                        <div className="space-y-3 mt-4">
                          {data.windows.map((window) => (
                            <div key={window.id} className="p-3 bg-white rounded-xl border border-primary/5 shadow-sm">
                              <p className="text-on-surface text-[15px] font-bold truncate mb-1">
                                {(window.systems || []).join('/') || 'SISTEMAS'}
                              </p>
                              <p className="text-on-surface-variant text-[13px] leading-relaxed">
                                {formatWindowFullTextPt(window)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* English Box */}
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-outline-variant/10 flex flex-col shadow-sm">
                      <div className="pb-3 border-b border-primary/10 mb-4">
                        <h5 className="text-[21px] font-headline font-bold text-on-surface leading-tight mt-1">
                          {translations?.en.title || 'Scheduled Interruption'}
                        </h5>
                      </div>
                      <div className="text-on-surface-variant text-[15px] leading-relaxed space-y-3 flex-1">
                        <p className="font-bold">Dear colleagues,</p>
                        <p>{translations?.en.intro || 'We inform you that we will perform essential technical maintenance to ensure the stability and performance of our digital infrastructure.'}</p>
                        <div className="space-y-3 mt-4">
                          {Array.isArray(translations?.en.windows) ? translations?.en.windows.map((w, i) => (
                            <div key={i} className="p-3 bg-white rounded-xl border border-primary/5 shadow-sm">
                              <p className="text-on-surface text-[15px] font-bold truncate mb-1">{w.systems || 'SISTEMAS'}</p>
                              <p className="text-on-surface-variant text-[13px] leading-relaxed">
                                {w.text}
                              </p>
                            </div>
                          )) : (
                            <div className="animate-pulse space-y-2">
                              <div className="h-16 bg-white rounded-xl"></div>
                              <div className="h-16 bg-white rounded-xl"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Chinese Box */}
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-outline-variant/10 flex flex-col shadow-sm">
                      <div className="pb-3 border-b border-primary/10 mb-4">
                        <h5 className="text-[21px] font-headline font-bold text-on-surface leading-tight mt-1">
                          {translations?.zh.title || '计划维护'}
                        </h5>
                      </div>
                      <div className="text-on-surface-variant text-[15px] leading-relaxed space-y-3 flex-1">
                        <p className="font-bold">各位同事：</p>
                        <p>{translations?.zh.intro || '我们通知您，我们将进行必要的业务技术维护，以确保我们数字基础设施的稳定性和性能。'}</p>
                        <div className="space-y-3 mt-4">
                          {Array.isArray(translations?.zh.windows) ? translations?.zh.windows.map((w, i) => (
                            <div key={i} className="p-3 bg-white rounded-xl border border-primary/5 shadow-sm">
                              <p className="text-on-surface text-[15px] font-bold truncate mb-1">{w.systems || 'SISTEMAS'}</p>
                              <p className="text-on-surface-variant text-[13px] leading-relaxed">
                                {w.text}
                              </p>
                            </div>
                          )) : (
                            <div className="animate-pulse space-y-2">
                              <div className="h-16 bg-white rounded-xl"></div>
                              <div className="h-16 bg-white rounded-xl"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Box */}
                <footer className="h-[162px] border border-outline-variant/10 flex justify-center items-center bg-slate-50/50 shrink-0 relative overflow-hidden rounded-2xl">
                  {data.settings.footerImage ? (
                    <div className="relative w-full h-full">
                      <Image 
                        src={data.settings.footerImage} 
                        alt="Footer" 
                        fill
                        priority
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 opacity-20">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Settings className="text-primary" size={16} />
                      </div>
                      <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">IT Infrastructure & Networks</span>
                    </div>
                  )}
                </footer>
              </div>
            </div>
          </section>
        </div>

        {/* Action Bar */}
        <div className="min-h-20 py-4 px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between bg-white border-t border-outline-variant/10 z-20 gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ActionButton icon={<RotateCcw size={16} />} label="Resetar" onClick={handleReset} />
            <ActionButton icon={<Copy size={16} />} label="Copiar Texto" onClick={handleCopyText} />
            <ActionButton 
              icon={<ImageIcon size={16} />} 
              label="Baixar Imagem" 
              onClick={handleDownloadImage} 
              disabled={!hasGeneratedCurrent}
              title={!hasGeneratedCurrent ? "Clique em 'Gerar Comunicado' primeiro para liberar o download" : "Baixar comunicado como imagem"}
            />
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <p className="hidden sm:block text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em]">
              © 2024 IT Maintenance Architect
            </p>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 lg:px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-white font-headline font-extrabold text-[16px] lg:text-[17px] rounded-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 group disabled:opacity-70 disabled:scale-100"
            >
              {isGenerating ? 'Gerando...' : 'Gerar Comunicado'}
              <Sparkles className={`text-white transition-transform ${isGenerating ? 'animate-spin' : 'group-hover:rotate-12'}`} size={18} />
            </button>
          </div>
        </div>
      </div>
      {/* Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <header className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-primary/5">
                <div>
                  <h3 className="text-[22px] font-headline font-extrabold text-primary tracking-tight">
                    {editingTemplate ? 'Editar Modelo' : 'Novo Modelo'}
                  </h3>
                  <p className="text-[15px] text-on-surface-variant">Configure os detalhes do seu modelo.</p>
                </div>
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors text-on-surface-variant"
                >
                  <X size={20} />
                </button>
              </header>

              <div className="p-6 overflow-y-auto space-y-6">
                <div>
                  <label className="block text-[12px] font-bold text-primary uppercase tracking-widest mb-2">Título do Modelo</label>
                  <input 
                    type="text"
                    placeholder="Ex: Manutenção de Servidores"
                    className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-[15px]"
                    defaultValue={editingTemplate?.title}
                    id="template-title"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-primary uppercase tracking-widest mb-2">Descrição Curta</label>
                  <input 
                    type="text"
                    placeholder="Ex: Utilizado para comunicados de rotina..."
                    className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-[15px]"
                    defaultValue={editingTemplate?.description}
                    id="template-desc"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-primary uppercase tracking-widest mb-2">Ícone</label>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.keys(ICON_MAP).map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          const el = document.getElementById('template-icon-type') as HTMLInputElement;
                          if (el) el.value = type;
                          // Force re-render for selection highlight if needed, but let's keep it simple
                          const buttons = document.querySelectorAll('.icon-select-btn');
                          buttons.forEach(b => b.classList.remove('bg-primary', 'text-white'));
                          buttons.forEach(b => b.classList.add('bg-surface-container-low', 'text-on-surface-variant'));
                          const target = document.getElementById(`icon-btn-${type}`);
                          if (target) {
                            target.classList.remove('bg-surface-container-low', 'text-on-surface-variant');
                            target.classList.add('bg-primary', 'text-white');
                          }
                        }}
                        id={`icon-btn-${type}`}
                        className={`icon-select-btn p-3 rounded-xl flex items-center justify-center transition-all ${
                          (editingTemplate?.iconType === type || (!editingTemplate && type === 'sparkles')) 
                            ? 'bg-primary text-white' 
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/10'
                        }`}
                      >
                        {ICON_MAP[type as keyof typeof ICON_MAP]}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" id="template-icon-type" defaultValue={editingTemplate?.iconType || 'sparkles'} />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-primary uppercase tracking-widest mb-2">Título do Comunicado (Português)</label>
                  <input 
                    type="text"
                    placeholder="Parada Programada"
                    className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-[15px]"
                    defaultValue={editingTemplate?.data.customTitlePt || INITIAL_DATA.customTitlePt}
                    id="template-title-pt"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-primary uppercase tracking-widest mb-2">Texto Padrão (Introdução)</label>
                  <textarea 
                    placeholder="Digite o texto que aparecerá por padrão neste modelo..."
                    className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-[15px] min-h-[120px] leading-relaxed"
                    defaultValue={editingTemplate?.data.customIntro}
                    id="template-intro"
                  />
                </div>

                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <p className="text-[13px] text-primary font-medium leading-relaxed">
                    <Info size={12} className="inline mr-1 mb-0.5" />
                    As janelas de manutenção atuais (datas e horários) serão salvas como parte deste modelo.
                  </p>
                </div>
              </div>

              <footer className="p-6 border-t border-outline-variant/10 bg-surface-container-low flex gap-3">
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="flex-1 py-3 text-[17px] font-bold text-on-surface-variant hover:bg-white rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const title = (document.getElementById('template-title') as HTMLInputElement).value;
                    const description = (document.getElementById('template-desc') as HTMLInputElement).value;
                    const iconType = (document.getElementById('template-icon-type') as HTMLInputElement).value as any;
                    const customIntro = (document.getElementById('template-intro') as HTMLInputElement).value;
                    const customTitlePt = (document.getElementById('template-title-pt') as HTMLInputElement).value;
                    
                    if (!title) return;

                    handleSaveTemplate({
                      id: editingTemplate?.id,
                      title,
                      description,
                      iconType,
                      data: {
                        ...data,
                        customIntro,
                        customTitlePt
                      }
                    });
                  }}
                  className="flex-1 py-3 bg-primary text-white text-[17px] font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-container hover:text-primary transition-all"
                >
                  Salvar Modelo
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-primary text-white border-primary/20' 
                : 'bg-tertiary text-white border-tertiary/20'
            }`}
          >
            {toast.type === 'success' ? <Check size={18} /> : <Info size={18} />}
            <span className="text-[17px] font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {templateToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTemplateToDelete(null)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-[22px] font-headline font-extrabold text-on-surface mb-2">Excluir Modelo?</h3>
              <p className="text-on-surface-variant text-[17px] mb-8">Esta ação não pode ser desfeita. O modelo será removido permanentemente.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTemplateToDelete(null)}
                  className="flex-1 py-3 text-[17px] font-bold text-on-surface-variant hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteTemplate(templateToDelete)}
                  className="flex-1 py-3 bg-tertiary text-white text-[17px] font-bold rounded-xl shadow-lg shadow-tertiary/20 hover:bg-tertiary-container hover:text-tertiary transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
            <h3 className="text-[22px] font-headline font-extrabold text-primary tracking-tight mb-2">Gerando Comunicado</h3>
            <p className="text-on-surface-variant text-[17px] animate-pulse">Processando layout e traduções de alta qualidade...</p>
            <div className="mt-8 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
              <p className="text-[12px] font-bold text-primary uppercase tracking-widest">Aguarde um momento</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
        active 
          ? 'bg-primary/5 text-primary font-bold translate-x-1' 
          : 'text-on-surface-variant hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <span className={`${active ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'} transition-colors`}>
        {icon}
      </span>
      <span className="font-headline text-[16px] tracking-tight">{label}</span>
      {active && <div className="ml-auto w-1 h-4 bg-primary rounded-full"></div>}
    </button>
  );
}

function ActionButton({ icon, label, onClick, disabled = false, title }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, title?: string }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-2 px-4 py-2 text-on-surface-variant hover:text-primary font-headline text-[13px] font-bold transition-all hover:bg-surface-container-low rounded-lg group disabled:opacity-40 disabled:hover:text-on-surface-variant disabled:hover:bg-transparent disabled:cursor-not-allowed"
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      {label}
    </button>
  );
}
