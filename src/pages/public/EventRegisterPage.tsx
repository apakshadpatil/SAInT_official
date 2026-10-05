import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Download,
  CheckCircle,
  Ticket,
  ArrowLeft,
  Loader2,
  CreditCard,
  Users,
  Plus,
  Trash2,
  ClipboardCheck,
  ExternalLink,
  MessageCircle,
  Sparkles,
  X,
  UploadCloud,
  Check,
  AlertCircle,
  Maximize2,
  Phone,
  User,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Lock,
} from 'lucide-react';
import {
  createRuleAgreement,
  getEvent,
  subscribeEventById,
  registerParticipantForEvent,
} from '../../services/eventService';
import type { EventRecord, EventTicket, TicketTier, TeamMemberDetail } from '../../types';
import { getEventCoordinators, isEventRegistrationOpen } from '../../types';
import { downloadTicketImage } from '../../utils/ticketDownload';
import { uploadFileToSupabase } from '../../utils/supabase';
import { compressPaymentProof } from '../../utils/imageOptimizer';
import { isValidRegistrationUrl } from '../../utils/urlValidation';
import QRCode from 'qrcode';
import EventBanner from '../../components/ui/EventBanner';

export default function EventRegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form Fields
  const [teamName, setTeamName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});

  // Field-level error validation map
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  // Multi-step form step tracking (1: Details, 2: Team/Payment, 3: Confirmation)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Dynamic Registration Fields Configuration Helper
  const getEffectiveRegistrationFields = (evt: EventRecord | null) => ({
    name: {
      enabled: evt?.registrationFields?.name?.enabled ?? true,
      required: evt?.registrationFields?.name?.required ?? true,
      label: evt?.registrationFields?.name?.label?.trim() || 'Full Name',
    },
    email: {
      enabled: evt?.registrationFields?.email?.enabled ?? true,
      required: evt?.registrationFields?.email?.required ?? false,
      label: evt?.registrationFields?.email?.label?.trim() || 'Email Address',
    },
    phone: {
      enabled: evt?.registrationFields?.phone?.enabled ?? true,
      required: evt?.registrationFields?.phone?.required ?? false,
      label: evt?.registrationFields?.phone?.label?.trim() || 'Phone Number',
    },
    college: {
      enabled: evt?.registrationFields?.college?.enabled ?? true,
      required: evt?.registrationFields?.college?.required ?? false,
      label: evt?.registrationFields?.college?.label?.trim() || 'College',
    },
    department: {
      enabled: evt?.registrationFields?.department?.enabled ?? true,
      required: evt?.registrationFields?.department?.required ?? false,
      label: evt?.registrationFields?.department?.label?.trim() || 'Department',
    },
    year: {
      enabled: evt?.registrationFields?.year?.enabled ?? true,
      required: evt?.registrationFields?.year?.required ?? false,
      label: evt?.registrationFields?.year?.label?.trim() || 'Year of Study',
    },
  });

  // Payment Proof Fields
  const [paymentScreenshotFile, setPaymentScreenshotFile] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string | null>(null);
  const [paymentScreenshotError, setPaymentScreenshotError] = useState<string>('');
  const [paymentProofWarning, setPaymentProofWarning] = useState<string | null>(null);
  const [showFullQRModal, setShowFullQRModal] = useState(false);
  const [qrImageStatus, setQrImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [qrRetryCount, setQrRetryCount] = useState(0);

  // Tier selection & Team members
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberDetail[]>([]);

  // Rules & Terms State
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [termsName, setTermsName] = useState('');
  const [termsEmail, setTermsEmail] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [agreeingToTerms, setAgreeingToTerms] = useState(false);

  // Non-disruptive Rules Side Drawer / Modal (Requirement #2)
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);

  const ticketStorageKey = eventId ? `saint-event-ticket:${eventId}` : '';
  const draftStorageKey = eventId ? `saint-reg-draft:${eventId}` : '';
  const formTopRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const qrSectionRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(activeStep);
  const isInitialMount = useRef(true);

  // 1. Initial Load & Real-Time Sync
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError('');

    const unsub = subscribeEventById(eventId, (e) => {
      if (e) {
        setEvent(e);
        setError('');

        if (e.registrationUrl && isValidRegistrationUrl(e.registrationUrl)) {
          window.location.replace(e.registrationUrl);
          return;
        }

        // Initialize tiers if available
        if (e.enableTieredTicketing && e.ticketTiers && e.ticketTiers.length > 0) {
          setSelectedTierId((prev) => prev || e.ticketTiers![0].id);
          const initialTeamSize = e.ticketTiers[0].teamSize || 1;
          if (initialTeamSize > 1) {
            setTeamMembers((prev) =>
              prev.length > 0
                ? prev
                : Array.from({ length: initialTeamSize - 1 }, () => ({
                    name: '',
                    email: '',
                    phone: '',
                    college: '',
                    department: '',
                    year: '',
                  }))
            );
          }
        } else if (e.teamsEnabled) {
          const minMembers = Math.max(1, (e.minTeamSize || 2) - 1);
          setTeamMembers((prev) =>
            prev.length > 0
              ? prev
              : Array.from({ length: minMembers }, () => ({
                  name: '',
                  email: '',
                  phone: '',
                  college: '',
                  department: '',
                  year: '',
                }))
          );
        }
        setLoading(false);
      } else {
        // Fallback: direct fetch
        getEvent(eventId, true)
          .then((directDoc) => {
            if (directDoc) {
              setEvent(directDoc);
              setError('');
              if (directDoc.registrationUrl && isValidRegistrationUrl(directDoc.registrationUrl)) {
                window.location.replace(directDoc.registrationUrl);
                return;
              }
            } else {
              setError('Event not found.');
            }
          })
          .catch(() => {
            setError('Event not found.');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    });

    // Check for already-issued ticket
    const storedTicket = ticketStorageKey ? sessionStorage.getItem(ticketStorageKey) : null;
    if (storedTicket) {
      try {
        const savedTicket = JSON.parse(storedTicket) as EventTicket;
        setTicket(savedTicket);
        QRCode.toDataURL(savedTicket.qrPayload, { width: 300, margin: 2 }).then(setQrDataUrl);
      } catch {
        sessionStorage.removeItem(ticketStorageKey);
      }
    }

    // Check for existing rules agreement
    const storedAgreement = eventId ? sessionStorage.getItem(`saint-event-rules-agreed:${eventId}`) : null;
    if (storedAgreement) {
      try {
        const agreement = JSON.parse(storedAgreement) as { name?: string; email?: string };
        setTermsName(agreement.name || '');
        setTermsEmail(agreement.email || '');
        setName((prev) => prev || agreement.name || '');
        setEmail((prev) => prev || agreement.email || '');
        setRulesAccepted(true);
      } catch {
        sessionStorage.removeItem(`saint-event-rules-agreed:${eventId}`);
      }
    }

    // Restore form draft (Requirement #9 - Preserve Form Data)
    const storedDraft = draftStorageKey ? sessionStorage.getItem(draftStorageKey) : null;
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        if (draft.name) setName(draft.name);
        if (draft.email) setEmail(draft.email);
        if (draft.phone) setPhone(draft.phone);
        if (draft.college) setCollege(draft.college);
        if (draft.department) setDepartment(draft.department);
        if (draft.year) setYear(draft.year);
        if (draft.teamName) setTeamName(draft.teamName);
        if (Array.isArray(draft.teamMembers) && draft.teamMembers.length > 0) {
          setTeamMembers(draft.teamMembers);
        }
        if (draft.selectedTierId) setSelectedTierId(draft.selectedTierId);
        if (draft.selectedDomainId) setSelectedDomainId(draft.selectedDomainId);
        if (draft.transactionId) setTransactionId(draft.transactionId);
        if (draft.customResponses) setCustomResponses(draft.customResponses);
        if (typeof draft.activeStep === 'number' && draft.activeStep >= 1) {
          setActiveStep(draft.activeStep);
        }
      } catch {
        sessionStorage.removeItem(draftStorageKey);
      }
    }

    return () => unsub();
  }, [eventId, ticketStorageKey, draftStorageKey]);

  // 2. Form Draft Auto-Save (Requirement #9)
  useEffect(() => {
    if (!eventId || ticket || loading) return;
    const draft = {
      name,
      email,
      phone,
      college,
      department,
      year,
      teamName,
      teamMembers,
      selectedTierId,
      selectedDomainId,
      transactionId,
      customResponses,
      activeStep,
    };
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }, [
    eventId,
    ticket,
    loading,
    name,
    email,
    phone,
    college,
    department,
    year,
    teamName,
    teamMembers,
    selectedTierId,
    selectedDomainId,
    transactionId,
    customResponses,
    activeStep,
    draftStorageKey,
  ]);

  // Derived Event & Form Properties
  const selectedTier = event?.ticketTiers?.find((t) => t.id === selectedTierId);
  const isTeam = Boolean(event?.teamsEnabled) || Boolean(selectedTier && selectedTier.teamSize > 1);
  const activePaymentQR = selectedTier?.paymentQRUrl || event?.paymentQRUrl;
  const showPaymentQR = Boolean(event?.ticketingEnabled && activePaymentQR);

  // Multi-step determination (Requirement #8)
  const isMultiStep = isTeam || showPaymentQR;
  const totalSteps = isMultiStep ? 3 : 2;

  // Rules acceptance requirement check (Requirement #1 & #12)
  const isRulesMandatory = Boolean(event?.requireRulesAcceptance);
  const isRulesPending = isRulesMandatory && !rulesAccepted;

  // Maximum and Minimum Team Size
  const maxTeamSize = selectedTier ? selectedTier.teamSize : event?.maxTeamSize || 4;
  const minTeamSize = selectedTier ? selectedTier.teamSize : event?.minTeamSize || 2;
  const currentTotalTeamSize = 1 + teamMembers.length;

  // QR Scroll Logic (Comfortably scroll to QR section without jumping to page top, accounting for fixed header)
  const scrollToQR = (retryCount = 0) => {
    requestAnimationFrame(() => {
      const el = qrSectionRef.current;
      if (!el) {
        if (retryCount < 5) {
          setTimeout(() => scrollToQR(retryCount + 1), 60);
        }
        return;
      }
      const rect = el.getBoundingClientRect();
      // Public header navbar is ~72px. Offset 75px on mobile, 85px on desktop to ensure QR section is not hidden behind header.
      const headerOffset = window.innerWidth < 640 ? 75 : 85;
      const targetY = window.scrollY + rect.top - headerOffset;

      window.scrollTo({
        top: Math.max(0, Math.round(targetY)),
        behavior: 'smooth',
      });
    });
  };

  const handleShowQRClick = () => {
    if (activeStep === 1) {
      if (validateStep1()) {
        setActiveStep(2);
        setTimeout(() => scrollToQR(0), 120);
      }
    } else {
      scrollToQR(0);
    }
  };

  // Step Scrolling Logic (Comfortably scroll to beginning of active step without jumping to page top)
  const scrollToStep = (targetStepNum?: number) => {
    requestAnimationFrame(() => {
      const currentStep = targetStepNum ?? activeStep;

      // When moving to step 2 for payment in an individual paid registration, focus directly on the QR section
      if (currentStep === 2 && !isTeam && showPaymentQR && qrSectionRef.current) {
        scrollToQR(0);
        return;
      }

      // In multi-step forms, progressRef gives context + sits right above the step heading & first field.
      // If single-step or progressRef unavailable, scroll to step container or form card.
      const targetElement =
        (isMultiStep && progressRef.current ? progressRef.current : null) ||
        (currentStep === 2 ? step2Ref.current : step1Ref.current) ||
        formCardRef.current;

      if (!targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      const offset = window.innerWidth < 640 ? 16 : 24;
      const targetY = window.scrollY + rect.top - offset;

      window.scrollTo({
        top: Math.max(0, Math.round(targetY)),
        behavior: 'smooth',
      });
    });
  };

  const scrollToFirstError = (fieldKey?: string, stepNum?: number) => {
    requestAnimationFrame(() => {
      if (fieldKey) {
        const el = document.querySelector(`[data-field-id="${fieldKey}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const offset = window.innerWidth < 640 ? 70 : 90;
          const targetY = window.scrollY + rect.top - offset;
          window.scrollTo({
            top: Math.max(0, Math.round(targetY)),
            behavior: 'smooth',
          });
          if ('focus' in el && typeof (el as HTMLElement).focus === 'function') {
            try {
              (el as HTMLElement).focus({ preventScroll: true });
            } catch {
              // ignore focus errors
            }
          }
          return;
        }
      }

      scrollToStep(stepNum);
    });
  };

  // Step Transition Scroll Effect: triggers whenever participant moves between steps
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (prevStepRef.current !== activeStep) {
      prevStepRef.current = activeStep;
      const timer = setTimeout(() => {
        scrollToStep(activeStep);
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [activeStep, isMultiStep]);

  const handleTierSelect = (tier: TicketTier) => {
    setSelectedTierId(tier.id);
    const size = tier.teamSize || 1;
    if (size > 1) {
      setTeamMembers((prev) => {
        const next: TeamMemberDetail[] = [];
        for (let i = 0; i < size - 1; i++) {
          next.push(
            prev[i] || { name: '', email: '', phone: '', college: '', department: '', year: '' }
          );
        }
        return next;
      });
    } else {
      setTeamMembers([]);
    }
  };

  const handleAddTeammate = () => {
    if (currentTotalTeamSize >= maxTeamSize) {
      setError(`Maximum team size is ${maxTeamSize} members (including leader).`);
      return;
    }
    setError('');
    setTeamMembers((prev) => [
      ...prev,
      { name: '', email: '', phone: '', college: '', department: '', year: '' },
    ]);
  };

  const handleRemoveTeammate = (index: number) => {
    if (currentTotalTeamSize <= minTeamSize) {
      setError(`Minimum team size is ${minTeamSize} members (including leader).`);
      return;
    }
    setError('');
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTeamMemberChange = (index: number, field: keyof TeamMemberDetail, value: string) => {
    setTeamMembers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    // Clear field-level error
    if (fieldErrors[`member_${index}_${field}`]) {
      setFieldErrors((prev) => ({ ...prev, [`member_${index}_${field}`]: '' }));
    }
  };

  // QR Image Handling
  useEffect(() => {
    setQrImageStatus('loading');
    setQrRetryCount(0);
  }, [activePaymentQR]);

  const handleQrError = () => {
    if (qrRetryCount < 2) {
      setTimeout(() => {
        setQrRetryCount((prev) => prev + 1);
        setQrImageStatus('loading');
      }, 800);
    } else {
      setQrImageStatus('error');
    }
  };

  const handleManualQrRetry = () => {
    setQrRetryCount((c) => c + 1);
    setQrImageStatus('loading');
  };

  const currentQrSrc = useMemo(() => {
    if (!activePaymentQR) return '';
    if (qrRetryCount === 0) return activePaymentQR;
    const sep = activePaymentQR.includes('?') ? '&' : '?';
    return `${activePaymentQR}${sep}retry=${qrRetryCount}`;
  }, [activePaymentQR, qrRetryCount]);

  // Clean up screenshot object URL
  useEffect(() => {
    return () => {
      if (paymentScreenshotPreview && paymentScreenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(paymentScreenshotPreview);
      }
    };
  }, [paymentScreenshotPreview]);

  const handleScreenshotChange = (file: File | null) => {
    setPaymentScreenshotError('');
    if (fieldErrors.paymentScreenshot) {
      setFieldErrors((prev) => ({ ...prev, paymentScreenshot: '' }));
    }

    if (!file) {
      if (paymentScreenshotPreview && paymentScreenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(paymentScreenshotPreview);
      }
      setPaymentScreenshotFile(null);
      setPaymentScreenshotPreview(null);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setPaymentScreenshotError('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }

    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setPaymentScreenshotError('Screenshot file size must be less than 15 MB.');
      return;
    }

    if (paymentScreenshotPreview && paymentScreenshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(paymentScreenshotPreview);
    }

    setPaymentScreenshotFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPaymentScreenshotPreview(objectUrl);
  };

  // Step 1 Validation (Details / Leader info)
  const validateStep1 = () => {
    if (!event) return false;
    const regFieldsConfig = getEffectiveRegistrationFields(event);
    const newErrors: Record<string, string> = {};

    if (regFieldsConfig.name.enabled && regFieldsConfig.name.required && !name.trim()) {
      newErrors.name = 'Please enter your full name.';
    }

    if (regFieldsConfig.email.enabled) {
      if (regFieldsConfig.email.required && !email.trim()) {
        newErrors.email = 'Please enter your email address.';
      } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    if (regFieldsConfig.phone.enabled) {
      if (regFieldsConfig.phone.required && !phone.trim()) {
        newErrors.phone = 'Please enter your phone number.';
      } else if (phone.trim() && phone.trim().replace(/[^0-9]/g, '').length < 10) {
        newErrors.phone = 'Please enter a valid 10-digit phone number.';
      }
    }

    if (regFieldsConfig.college.enabled && regFieldsConfig.college.required && !college.trim()) {
      newErrors.college = 'Please enter your college name.';
    }

    if (regFieldsConfig.department.enabled && regFieldsConfig.department.required && !department.trim()) {
      newErrors.department = 'Please enter your department.';
    }

    if (regFieldsConfig.year.enabled && regFieldsConfig.year.required && !year.trim()) {
      newErrors.year = 'Please select your year of study.';
    }

    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      setError(newErrors[firstKey]);
      scrollToFirstError(firstKey, 1);
      return false;
    }

    setError('');
    return true;
  };

  // Step 2 Validation (Team, Payment, Custom Questions)
  const validateStep2 = () => {
    if (!event) return false;
    const regFieldsConfig = getEffectiveRegistrationFields(event);
    const newErrors: Record<string, string> = {};

    if (isTeam && !teamName.trim()) {
      newErrors.teamName = 'Please enter your Team Name.';
    }

    // Validate team members
    if (isTeam && teamMembers.length > 0) {
      for (let i = 0; i < teamMembers.length; i++) {
        const m = teamMembers[i];
        const num = i + 2;

        if (regFieldsConfig.name.enabled && regFieldsConfig.name.required && !m.name?.trim()) {
          newErrors[`member_${i}_name`] = `Please enter the full name for Teammate #${num}.`;
        }

        if (regFieldsConfig.email.enabled) {
          if (regFieldsConfig.email.required && !m.email?.trim()) {
            newErrors[`member_${i}_email`] = `Please enter email address for Teammate #${num}.`;
          } else if (m.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim())) {
            newErrors[`member_${i}_email`] = `Please enter a valid email for Teammate #${num}.`;
          }
        }

        if (regFieldsConfig.phone.enabled) {
          if (regFieldsConfig.phone.required && !m.phone?.trim()) {
            newErrors[`member_${i}_phone`] = `Please enter phone number for Teammate #${num}.`;
          } else if (m.phone?.trim() && m.phone.trim().replace(/[^0-9]/g, '').length < 10) {
            newErrors[`member_${i}_phone`] = `Please enter a valid 10-digit phone for Teammate #${num}.`;
          }
        }

        if (regFieldsConfig.college.enabled && regFieldsConfig.college.required && !m.college?.trim()) {
          newErrors[`member_${i}_college`] = `Please enter college name for Teammate #${num}.`;
        }

        if (regFieldsConfig.department.enabled && regFieldsConfig.department.required && !m.department?.trim()) {
          newErrors[`member_${i}_department`] = `Please enter department for Teammate #${num}.`;
        }

        if (regFieldsConfig.year.enabled && regFieldsConfig.year.required && !m.year?.trim()) {
          newErrors[`member_${i}_year`] = `Please select year of study for Teammate #${num}.`;
        }
      }
    }

    // Validate required custom fields
    const applicableCustomFields = (event.customFields || []).filter(
      (f) => !f.tierId || f.tierId === selectedTierId
    );
    for (const field of applicableCustomFields) {
      if (field.required && !customResponses[field.id]?.trim()) {
        newErrors[`custom_${field.id}`] = `Please complete required question: "${field.label}"`;
      }
    }

    // Validate payment fields if paid event
    if (showPaymentQR) {
      const cleanTxId = transactionId.trim();
      if (!cleanTxId) {
        newErrors.transactionId = 'Please enter your UPI Transaction ID / UTR number.';
      } else if (cleanTxId.length < 6) {
        newErrors.transactionId = 'Please enter a valid UPI Transaction ID (at least 6 characters).';
      }

      if (!paymentScreenshotFile) {
        newErrors.paymentScreenshot = 'Please upload your payment screenshot before submitting.';
      }
    }

    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      setError(newErrors[firstKey]);
      scrollToFirstError(firstKey, 2);
      return false;
    }

    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (activeStep === 1) {
      if (validateStep1()) {
        setActiveStep(2);
      }
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      setActiveStep(1);
    }
  };

  // Submit Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !eventId) return;

    if (!isEventRegistrationOpen(event)) {
      setError('Registration is currently closed for this event.');
      return;
    }

    // Validate all steps
    if (!validateStep1()) {
      setActiveStep(1);
      return;
    }
    if (isMultiStep && activeStep === 1) {
      setActiveStep(2);
      return;
    }
    if (isMultiStep && !validateStep2()) {
      return;
    }
    if (!isMultiStep && !validateStep2()) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let uploadedScreenshotUrl: string | undefined = undefined;
      let uploadedScreenshotPath: string | undefined = undefined;
      let uploadFailedNotice: string | null = null;

      if (showPaymentQR && paymentScreenshotFile) {
        try {
          const fileToUpload = await compressPaymentProof(paymentScreenshotFile);
          const cleanFileName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          uploadedScreenshotPath = `payment_proofs/${eventId}/${Date.now()}_${cleanFileName}`;
          uploadedScreenshotUrl = await uploadFileToSupabase(fileToUpload, uploadedScreenshotPath);
        } catch (uploadErr) {
          console.warn('[Payment] Screenshot upload failed, continuing with UTR:', uploadErr);
          uploadFailedNotice =
            "Payment screenshot couldn't be uploaded directly right now. Your registration is recorded with your UTR, and you can upload the screenshot later from your Participant Dashboard.";
        }
      }

      const finalCustomResponses = {
        ...customResponses,
        ...(isTeam && teamName.trim() ? { teamName: teamName.trim() } : {}),
      };

      const calculatedTeamSize = selectedTier
        ? selectedTier.teamSize
        : isTeam
        ? 1 + teamMembers.length
        : 1;

      const { ticket: newTicket } = await registerParticipantForEvent(eventId, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        college: college.trim() || undefined,
        department: department.trim() || undefined,
        year: year.trim() || undefined,
        domain: event.participantDomains?.find((d) => d.id === selectedDomainId)?.name,
        domainId: selectedDomainId || undefined,
        tierId: selectedTier?.id,
        tierName: selectedTier?.name,
        teamSize: calculatedTeamSize,
        teamMembers: isTeam && teamMembers.length > 0 ? teamMembers : undefined,
        transactionId: showPaymentQR ? transactionId.trim() : transactionId.trim() || undefined,
        paymentScreenshotUrl: uploadedScreenshotUrl,
        paymentScreenshotPath: uploadedScreenshotPath,
        paymentStatus: showPaymentQR ? 'pending' : undefined,
        customResponses: Object.keys(finalCustomResponses).length > 0 ? finalCustomResponses : undefined,
        registrationSource: 'public',
      });

      const qr = await QRCode.toDataURL(newTicket.qrPayload, { width: 300, margin: 2 });
      if (uploadFailedNotice) {
        setPaymentProofWarning(uploadFailedNotice);
      }

      setTicket(newTicket);
      setQrDataUrl(qr);
      setActiveStep(totalSteps);

      // Save confirmed ticket & clear draft (Requirement #9)
      sessionStorage.setItem(ticketStorageKey, JSON.stringify(newTicket));
      sessionStorage.setItem(
        'saint-participant-registration',
        JSON.stringify({
          name: newTicket.guestName,
          email: newTicket.guestEmail || '',
        })
      );
      if (draftStorageKey) {
        sessionStorage.removeItem(draftStorageKey);
      }

      downloadTicketImage(event, newTicket, qr).catch((dlErr) => {
        console.warn('[Ticket] Auto download skipped by browser:', dlErr);
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration could not be completed. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!ticket || !qrDataUrl || !event) return;
    await downloadTicketImage(event, ticket, qrDataUrl);
  };

  // Handle accepting rules when requireRulesAcceptance is ON (Requirement #1 & #3)
  const handleAcceptRules = async () => {
    if (!eventId || !event) return;

    if (!isEventRegistrationOpen(event)) {
      setError('Registration is currently closed for this event.');
      return;
    }

    if (!termsChecked) {
      setError('Please review and check the agreement checkbox to continue.');
      return;
    }

    setAgreeingToTerms(true);
    setError('');

    try {
      let sessionId = '';
      try {
        sessionId =
          sessionStorage.getItem('saint-rule-session') ||
          `rules_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('saint-rule-session', sessionId);
      } catch {
        /* storage optional */
      }

      const attendeeName = termsName.trim() || name.trim() || 'Attendee';
      const attendeeEmail = termsEmail.trim() || email.trim() || 'attendee@event.local';

      await createRuleAgreement(eventId, { attendeeName, attendeeEmail, sessionId });

      const stored = { name: attendeeName, email: attendeeEmail };
      try {
        sessionStorage.setItem(`saint-event-rules-agreed:${eventId}`, JSON.stringify(stored));
      } catch {
        /* storage optional */
      }

      // Sync seamlessly to registration form so participant never re-types them (Requirement #3)
      if (attendeeName !== 'Attendee') setName(attendeeName);
      if (attendeeEmail !== 'attendee@event.local') setEmail(attendeeEmail);
      setRulesAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record agreement. Please try again.');
    } finally {
      setAgreeingToTerms(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}
      >
        <div className="public-bg-blobs" aria-hidden="true">
          <div className="public-liquid-blob-1" />
          <div className="public-liquid-blob-2" />
        </div>
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin relative z-10" />
      </div>
    );
  }

  // Not Found Screen
  if (!event) {
    return (
      <div
        className="min-h-screen flex items-center justify-center flex-col gap-4 relative overflow-hidden text-center p-4"
        style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}
      >
        <div className="public-bg-blobs" aria-hidden="true">
          <div className="public-liquid-blob-1" />
          <div className="public-liquid-blob-2" />
        </div>
        <p className="text-white text-xl font-bold relative z-10">Event Not Found</p>
        <p className="text-sm text-slate-300 max-w-sm relative z-10">
          The requested event registration link may have expired or is no longer listed.
        </p>
        <Link
          to="/events"
          className="text-blue-300 hover:text-white underline text-sm flex items-center gap-1.5 relative z-10 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Browse All Events
        </Link>
      </div>
    );
  }

  const registrationClosed = !isEventRegistrationOpen(event);
  const showDomainSelection = Boolean(event.enableDomainSelection && event.participantDomains?.length);
  const applicableCustomFields = (event.customFields || []).filter(
    (f) => !f.tierId || f.tierId === selectedTierId
  );
  const regFieldsConfig = getEffectiveRegistrationFields(event);
  const coordinators = getEventCoordinators(event);

  const registrationBanner =
    (event.registrationBannerUrl && event.registrationBannerUrl.trim()) ||
    (event.imageURL && event.imageURL.trim()) ||
    ((event as any).bannerUrl && (event as any).bannerUrl.trim()) ||
    ((event as any).imageUrl && (event as any).imageUrl.trim()) ||
    null;
  const hasCustomBg = Boolean(event.registrationBackgroundUrl);

  const rulesContent =
    event.registrationTerms?.trim() ||
    (event.rules?.length
      ? event.rules.join('\n\n')
      : `1. Carry your digital QR entry pass to the event venue for admission check-in.\n2. Follow the published event schedule, venue safety guidelines, and coordinator instructions.\n3. Maintain professional and respectful conduct throughout all sessions, workshops, and competitions.\n4. Organizers reserve the right to revoke passes or disqualify participants for rule violations or misconduct.`);

  return (
    <div className="min-h-screen relative text-white">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {hasCustomBg ? (
          <>
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${event.registrationBackgroundUrl})` }}
            />
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[3px]" />
          </>
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)' }}
          >
            <div className="public-bg-blobs">
              <div className="public-liquid-blob-1" style={{ opacity: 0.7 }} />
              <div className="public-liquid-blob-2" style={{ opacity: 0.65 }} />
              <div className="public-liquid-blob-3" style={{ opacity: 0.55 }} />
            </div>
          </div>
        )}
      </div>

      <div
        ref={formTopRef}
        className="relative z-10 max-w-3xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col justify-start"
      >
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6">
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-1.5 text-blue-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Event Details
          </Link>
          <Link to="/events" className="text-xs text-slate-400 hover:text-white transition-colors">
            All Events →
          </Link>
        </div>

        {/* Event Header Banner Card */}
        <div
          className="rounded-2xl overflow-hidden mb-6 shadow-2xl border"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <EventBanner
            src={registrationBanner}
            alt={event.title}
            aspectRatioClass="aspect-video"
            maxHeightClass="max-h-[340px]"
            showOverlay={false}
            priority={true}
            fallbackIcon={<Ticket className="w-10 h-10 text-emerald-400/40" />}
          />

          <div className="p-4 sm:p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59,130,246,0.3)',
                }}
              >
                <Ticket className="w-3.5 h-3.5" /> Event Registration
              </div>

              {/* View Rules & Guidelines Header Action */}
              <button
                type="button"
                onClick={() => setShowRulesDrawer(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-200 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/35 transition-all cursor-pointer shadow-sm active:scale-[0.98] group"
              >
                <span className="text-sm select-none group-hover:scale-110 transition-transform" aria-hidden="true">
                  📖
                </span>
                <span>View Rules &amp; Guidelines</span>
              </button>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white mb-3">
              {event.title}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  {new Date(event.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  {event.startTime} {event.endTime ? `– ${event.endTime}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate" title={`${event.venue ? event.venue + ', ' : ''}${event.location || ''}`}>
                  {event.venue || event.location || 'On Campus'}
                </span>
              </div>
            </div>

            {/* Event Coordinators */}
            {coordinators.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                  {coordinators.length === 1 ? 'Event Coordinator' : 'Event Coordinators'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {coordinators.map((coord, idx) => (
                    <div
                      key={coord.id || idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-white truncate">{coord.name}</span>
                      </div>
                      <a
                        href={`tel:${coord.phone.replace(/\s+/g, '')}`}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1 shrink-0"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── STATE 1: REGISTRATION CONFIRMED / SUCCESS ────────────────────────── */}
        {ticket ? (
          <div
            className="rounded-3xl p-6 sm:p-8 text-center space-y-6 animate-fade-in shadow-2xl"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              backdropFilter: 'blur(28px)',
            }}
          >
            {/* Header (Requirement #11) */}
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 bg-emerald-500/15 border-2 border-emerald-500/50">
                <CheckCircle className="w-9 h-9 text-emerald-400" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 inline-block mb-2">
                  Pass Confirmed &amp; Issued
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  🎉 Registration Successful!
                </h2>
                <p className="text-sm mt-1.5 max-w-lg mx-auto text-slate-300">
                  Welcome, <strong className="text-white font-bold">{ticket.guestName}</strong>! Your official digital pass for <strong className="text-white font-semibold">{event.title}</strong> is ready.
                </p>
              </div>
            </div>

            {/* Warning if payment upload was deferred */}
            {paymentProofWarning && (
              <div className="max-w-md mx-auto p-4 rounded-2xl text-left flex items-start gap-3 bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Payment Proof Notice
                  </p>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {paymentProofWarning}
                  </p>
                </div>
              </div>
            )}

            {/* Ticket QR Presentation */}
            <div className="inline-block p-4 sm:p-5 bg-white rounded-3xl shadow-2xl transition-transform hover:scale-[1.01]">
              <img
                src={qrDataUrl}
                alt={`Ticket Pass QR for ${ticket.ticketNumber}`}
                className="w-56 h-56 sm:w-64 sm:h-64 block"
              />
            </div>

            {/* Summary Details Card (Requirement #11) */}
            <div
              className="rounded-2xl px-5 py-4 text-sm max-w-md mx-auto space-y-2 text-left bg-white/5 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Registration ID:
                </span>
                <span className="text-white font-mono font-bold text-base px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
                  {ticket.ticketNumber}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-slate-400">Registration Type:</span>
                <span className="text-slate-200 font-semibold">
                  {ticket.teamName
                    ? `Team Pass (${ticket.teamName})`
                    : ticket.tierName || 'Individual Pass'}
                </span>
              </div>

              {ticket.guestEmail && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-200 font-medium truncate max-w-[220px]">
                    {ticket.guestEmail}
                  </span>
                </div>
              )}

              {ticket.teamMembers && ticket.teamMembers.length > 0 && (
                <div className="pt-2 border-t border-white/10 text-xs">
                  <span className="font-semibold text-blue-400 block mb-1">
                    Registered Members ({ticket.teamMembers.length + 1} Total):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold">
                      {ticket.guestName} (Leader)
                    </span>
                    {ticket.teamMembers.map((m, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px]"
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action: Download Ticket */}
            <div>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white text-sm transition-all shadow-lg shadow-blue-500/25 hover:opacity-95 active:scale-[0.98] cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              >
                <Download className="w-4 h-4" />
                Download Ticket Image (.PNG)
              </button>
              <p className="text-xs mt-2 text-slate-400">
                Present this QR code or saved image on your phone during event check-in.
              </p>
            </div>

            {/* WhatsApp Group Link */}
            {event.whatsappGroupUrl && (
              <div
                className="rounded-2xl border border-emerald-500/35 p-4 sm:p-5 max-w-xl mx-auto text-left shadow-xl"
                style={{
                  background: 'linear-gradient(145deg, rgba(6, 78, 59, 0.25) 0%, rgba(2, 44, 34, 0.35) 100%)',
                }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Join Official WhatsApp Group</h4>
                      <p className="text-xs text-slate-300">
                        Get live announcements, schedules, and venue updates.
                      </p>
                    </div>
                  </div>
                  <a
                    href={event.whatsappGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-all shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Join Group
                  </a>
                </div>
              </div>
            )}

            {/* Event Rule Book Link */}
            {Boolean(event.rulebookUrl?.trim()) && (
              <div
                data-testid="event-rulebook-link"
                className="rounded-2xl border border-blue-500/35 p-4 sm:p-5 max-w-xl mx-auto text-left shadow-xl"
                style={{
                  background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.35) 100%)',
                }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>📖</span> View Rule Book
                      </h4>
                      <p className="text-xs text-slate-300">
                        Official guidelines, event format, and judging criteria for {event.title}.
                      </p>
                    </div>
                  </div>
                  <a
                    href={event.rulebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md shadow-blue-600/30"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View Rule Book
                  </a>
                </div>
              </div>
            )}

            {/* Participant Account Claim Onboarding */}
            <div className="rounded-2xl border border-blue-500/25 p-5 max-w-xl mx-auto text-left bg-slate-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Participant Dashboard
                </span>
                <span className="text-[11px] font-mono text-emerald-400">Claim Pass</span>
              </div>
              <p className="text-xs text-slate-300">
                Create a participant profile or log in to manage your tickets, access schedules, and view certificates anytime.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/participant-auth?mode=signup')}
                  className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer text-center"
                >
                  Create Participant Account →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/participant-auth')}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 hover:bg-white/5 transition-all text-center cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        ) : registrationClosed ? (
          /* ── STATE 2: REGISTRATION CLOSED ────────────────────────────────── */
          <div
            className="rounded-3xl p-8 sm:p-12 text-center bg-white/[0.04] border border-red-500/30 backdrop-blur-xl shadow-2xl max-w-xl mx-auto space-y-5 animate-fade-in"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 grid place-items-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Registration Closed
            </div>
            <h2 className="text-2xl font-bold text-white">Registrations for this event are currently closed.</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              Online registrations are not currently being accepted. If you have already registered, your existing entry remains safe and you can access your pass from the participant portal.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={`/events/${eventId}`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all text-center"
              >
                View Event Details
              </Link>
              <Link
                to="/events"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all text-center shadow-md"
              >
                Browse All Events
              </Link>
            </div>
          </div>
        ) : isRulesPending ? (
          /* ── STATE 3: RULES ACCEPTANCE (ONLY WHEN REQUIRE RULES ACCEPTANCE = ON) ── */
          <div
            className="rounded-2xl p-6 sm:p-8 space-y-6 animate-fade-in bg-white/[0.04] border border-blue-500/30 backdrop-blur-xl"
          >
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-300 grid place-items-center mx-auto mb-3">
                <ClipboardCheck className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-white">Event Rules &amp; Guidelines</h2>
              <p className="text-sm mt-1.5 text-slate-300">
                Please review and accept the official rules before completing your registration.
              </p>
            </div>

            {/* Scrollable rules box */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 max-h-80 overflow-y-auto text-sm text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
              {rulesContent}
            </div>

            {event.rulebookUrl && (
              <div className="text-left">
                <a
                  href={event.rulebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-blue-300 hover:text-blue-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Read official event rulebook PDF
                </a>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Name/Email entry seamlessly prefilled and flowing into registration (Requirement #3) */}
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Name (Optional for agreement)
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  value={termsName || name}
                  onChange={(e) => {
                    setTermsName(e.target.value);
                    setName(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Address (Optional for agreement)
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={termsEmail || email}
                  onChange={(e) => {
                    setTermsEmail(e.target.value);
                    setEmail(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-blue-400/20 bg-blue-500/5 p-4 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-200">
                I have read and agree to all rules, guidelines, and terms for{' '}
                <strong className="text-white">{event.title}</strong>.
              </span>
            </label>

            <button
              type="button"
              onClick={handleAcceptRules}
              disabled={agreeingToTerms}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:opacity-95 active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}
            >
              {agreeingToTerms ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Recording agreement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Agree &amp; Continue to Registration Form
                </>
              )}
            </button>
          </div>
        ) : (
          /* ── STATE 4: DIRECT REGISTRATION FORM (DEFAULT WHEN RULES OFF, OR AFTER RULES ON) ── */
          <div
            ref={formCardRef}
            className="rounded-2xl p-5 sm:p-8 bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl space-y-6"
          >
            {/* Header with Rules Drawer CTA (Requirement #2) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Event Registration</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete the details below to receive your digital entry pass. No account required.
                </p>
              </div>

              {/* View Rules & Guidelines button (prominent secondary action) */}
              <button
                type="button"
                onClick={() => setShowRulesDrawer(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-blue-100 hover:text-white bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-blue-900/40 hover:from-blue-800/50 hover:via-indigo-800/40 hover:to-blue-800/50 border border-blue-400/40 hover:border-blue-300/70 shadow-sm hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 cursor-pointer shrink-0 active:scale-[0.98] group"
              >
                <span
                  className="text-base sm:text-lg leading-none select-none group-hover:scale-110 transition-transform"
                  aria-hidden="true"
                >
                  📖
                </span>
                <span className="tracking-wide">View Rules &amp; Guidelines</span>
              </button>
            </div>

            {/* Progress Indicator for Longer / Multi-Step Forms (Requirement #8) */}
            {isMultiStep && (
              <div ref={progressRef} className="py-2">
                <div className="flex items-center justify-between relative max-w-md mx-auto">
                  {/* Track line */}
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-0">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: activeStep === 1 ? '0%' : activeStep === 2 ? '50%' : '100%',
                      }}
                    />
                  </div>

                  {/* Step 1: Details */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        activeStep >= 1
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-md'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {activeStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300 mt-1">
                      {isTeam ? 'Leader' : 'Details'}
                    </span>
                  </div>

                  {/* Step 2: Team / Payment */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        activeStep >= 2
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-md'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {activeStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300 mt-1">
                      {isTeam ? 'Team' : 'Payment'}
                    </span>
                  </div>

                  {/* Step 3: Confirmation */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        activeStep >= 3
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20 shadow-md'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      3
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300 mt-1">
                      Pass
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-xl text-xs sm:text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* --- REGISTRATION TIER / TEAM SIZE SELECTOR --- */}
            {event.enableTieredTicketing && event.ticketTiers && event.ticketTiers.length > 0 && (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-400">
                  Select Registration Tier / Team Size *
                </label>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {event.ticketTiers.map((tier) => (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => handleTierSelect(tier)}
                      className="p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between"
                      style={{
                        borderColor: selectedTierId === tier.id ? '#3b82f6' : 'rgba(255,255,255,0.12)',
                        background:
                          selectedTierId === tier.id
                            ? 'rgba(59,130,246,0.18)'
                            : 'rgba(255,255,255,0.03)',
                        boxShadow:
                          selectedTierId === tier.id ? '0 0 15px rgba(59,130,246,0.25)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                          {tier.teamSize === 1 ? 'Solo Entry (1 Member)' : `Team of ${tier.teamSize}`}
                        </span>
                        {tier.price !== undefined && (
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {tier.price === 0 ? 'Free' : `₹${tier.price}`}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-white text-sm">{tier.name}</h4>
                      {tier.description && (
                        <p className="text-xs text-slate-300 mt-1">{tier.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-6">
              {/* ─────────────────────────────────────────────────────────────
                  STEP 1: DETAILS / TEAM LEADER (Requirement #6 & #8)
                  ───────────────────────────────────────────────────────────── */}
              {(!isMultiStep || activeStep === 1) && (
                <div ref={step1Ref} className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-white/5">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {isTeam ? 'Team Leader Details' : 'Attendee Information'}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      Step 1 of {totalSteps}
                    </span>
                  </div>

                  {/* Name */}
                  {regFieldsConfig.name.enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-300">
                        {regFieldsConfig.name.label}{' '}
                        {regFieldsConfig.name.required ? (
                          <span className="text-red-400">*</span>
                        ) : (
                          '(Optional)'
                        )}
                      </label>
                      <input
                        type="text"
                        autoComplete="name"
                        data-field-id="name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
                        }}
                        placeholder={`Enter your ${regFieldsConfig.name.label.toLowerCase()}`}
                        className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border outline-none transition-colors ${
                          fieldErrors.name
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-white/10 focus:border-blue-400'
                        }`}
                      />
                      {fieldErrors.name && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {fieldErrors.name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Email & Phone */}
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    {regFieldsConfig.email.enabled && (
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-300">
                          {regFieldsConfig.email.label}{' '}
                          {regFieldsConfig.email.required ? (
                            <span className="text-red-400">*</span>
                          ) : (
                            '(Optional)'
                          )}
                        </label>
                        <input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          data-field-id="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                          }}
                          placeholder="your@email.com"
                          className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border outline-none transition-colors ${
                            fieldErrors.email
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-white/10 focus:border-blue-400'
                          }`}
                        />
                        {fieldErrors.email && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.email}
                          </p>
                        )}
                      </div>
                    )}

                    {regFieldsConfig.phone.enabled && (
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-300">
                          {regFieldsConfig.phone.label}{' '}
                          {regFieldsConfig.phone.required ? (
                            <span className="text-red-400">*</span>
                          ) : (
                            '(Optional)'
                          )}
                        </label>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          data-field-id="phone"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
                          }}
                          placeholder="10-digit mobile number"
                          className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border outline-none transition-colors ${
                            fieldErrors.phone
                              ? 'border-red-400 focus:border-red-500'
                            : 'border-white/10 focus:border-blue-400'
                          }`}
                        />
                        {fieldErrors.phone && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.phone}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* College & Department */}
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    {regFieldsConfig.college.enabled && (
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-300">
                          {regFieldsConfig.college.label}{' '}
                          {regFieldsConfig.college.required ? (
                            <span className="text-red-400">*</span>
                          ) : (
                            '(Optional)'
                          )}
                        </label>
                        <input
                          type="text"
                          data-field-id="college"
                          value={college}
                          onChange={(e) => {
                            setCollege(e.target.value);
                            if (fieldErrors.college) setFieldErrors((prev) => ({ ...prev, college: '' }));
                          }}
                          placeholder="e.g. JSPM RSCOE"
                          className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border outline-none transition-colors ${
                            fieldErrors.college
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-white/10 focus:border-blue-400'
                          }`}
                        />
                        {fieldErrors.college && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.college}
                          </p>
                        )}
                      </div>
                    )}

                    {regFieldsConfig.department.enabled && (
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-300">
                          {regFieldsConfig.department.label}{' '}
                          {regFieldsConfig.department.required ? (
                            <span className="text-red-400">*</span>
                          ) : (
                            '(Optional)'
                          )}
                        </label>
                        <input
                          type="text"
                          data-field-id="department"
                          value={department}
                          onChange={(e) => {
                            setDepartment(e.target.value);
                            if (fieldErrors.department)
                              setFieldErrors((prev) => ({ ...prev, department: '' }));
                          }}
                          placeholder="e.g. Information Technology"
                          className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border outline-none transition-colors ${
                            fieldErrors.department
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-white/10 focus:border-blue-400'
                          }`}
                        />
                        {fieldErrors.department && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.department}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Year of study */}
                  {regFieldsConfig.year.enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-300">
                        {regFieldsConfig.year.label}{' '}
                        {regFieldsConfig.year.required ? (
                          <span className="text-red-400">*</span>
                        ) : (
                          '(Optional)'
                        )}
                      </label>
                      <select
                        data-field-id="year"
                        value={year}
                        onChange={(e) => {
                          setYear(e.target.value);
                          if (fieldErrors.year) setFieldErrors((prev) => ({ ...prev, year: '' }));
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-slate-900 border outline-none transition-colors cursor-pointer ${
                          fieldErrors.year
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-white/15 focus:border-blue-400'
                        }`}
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                      >
                        <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                          Select {regFieldsConfig.year.label}
                        </option>
                        <option value="1st Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          1st Year
                        </option>
                        <option value="2nd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          2nd Year
                        </option>
                        <option value="3rd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          3rd Year
                        </option>
                        <option value="4th Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          4th Year
                        </option>
                        <option value="Postgraduate" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          Postgraduate (PG)
                        </option>
                        <option value="Other" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          Other
                        </option>
                      </select>
                      {fieldErrors.year && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {fieldErrors.year}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Multi-step continuation button */}
                  {isMultiStep && activeStep === 1 && (
                    <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold text-white text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:opacity-95 active:scale-[0.98] transition-all"
                        style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}
                      >
                        <span>Continue to {isTeam ? 'Team Details' : 'Payment'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      {showPaymentQR && (
                        <button
                          type="button"
                          onClick={handleShowQRClick}
                          data-action="show-qr"
                          className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-sm"
                        >
                          <QrCode className="w-4 h-4 text-blue-400" />
                          <span>Show QR</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  STEP 2: TEAM & MEMBERS / PAYMENT (Requirement #6 & #8)
                  ───────────────────────────────────────────────────────────── */}
              {(!isMultiStep || activeStep === 2) && (
                <div ref={step2Ref} className="space-y-6">
                  {/* Quick-Jump to QR if payment required */}
                  {showPaymentQR && (
                    <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs gap-3">
                      <div className="flex items-center gap-2 text-slate-300 min-w-0">
                        <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">
                          Registration requires UPI QR payment.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => scrollToQR(0)}
                        data-action="show-qr"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all cursor-pointer shrink-0"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Show QR</span>
                      </button>
                    </div>
                  )}

                  {/* Team Details Section (Requirement #6) */}
                  {isTeam && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between pb-1 border-b border-white/5">
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Team Details
                        </p>
                        <span className="text-[11px] text-slate-400">
                          Step 2 of {totalSteps}
                        </span>
                      </div>

                      {/* Team Name */}
                      <div className="p-4 rounded-2xl border bg-purple-500/5 border-purple-500/20 space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-purple-300">
                          Team Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          data-field-id="teamName"
                          value={teamName}
                          onChange={(e) => {
                            setTeamName(e.target.value);
                            if (fieldErrors.teamName)
                              setFieldErrors((prev) => ({ ...prev, teamName: '' }));
                          }}
                          placeholder="e.g. CyberKnights, CodeCrafters..."
                          className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border outline-none transition-colors ${
                            fieldErrors.teamName
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-white/10 focus:border-purple-400'
                          }`}
                        />
                        {fieldErrors.teamName ? (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.teamName}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            This name will be displayed on team schedules and participation certificates.
                          </p>
                        )}
                      </div>

                      {/* Team Members Section Header with Team Size counter (Requirement #6) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            Team Members
                            {/* Explicit Team Size counter badge: Team Size: 3 / 5 */}
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Team Size: {currentTotalTeamSize} / {maxTeamSize}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Leader + {teamMembers.length} teammate{teamMembers.length === 1 ? '' : 's'} registered.
                            {minTeamSize === maxTeamSize
                              ? ` Fixed team size of ${minTeamSize}.`
                              : ` Allowed range: ${minTeamSize}–${maxTeamSize} members.`}
                          </p>
                        </div>

                        {/* Add Member button (only if team is not at max capacity) */}
                        {!selectedTier && currentTotalTeamSize < maxTeamSize && (
                          <button
                            type="button"
                            onClick={handleAddTeammate}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Member</span>
                          </button>
                        )}
                      </div>

                      {/* Teammates List */}
                      {teamMembers.map((member, idx) => (
                        <div
                          key={idx}
                          className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3 relative group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                              <User className="w-3 h-3" /> Member #{idx + 2}
                            </span>

                            {!selectedTier && currentTotalTeamSize > minTeamSize && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTeammate(idx)}
                                className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer transition-colors p-1 rounded hover:bg-red-500/10"
                                title="Remove member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          {/* Member Name */}
                          {regFieldsConfig.name.enabled && (
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-slate-300">
                                {regFieldsConfig.name.label}{' '}
                                {regFieldsConfig.name.required ? (
                                  <span className="text-red-400">*</span>
                                ) : (
                                  '(Optional)'
                                )}
                              </label>
                              <input
                                type="text"
                                data-field-id={`member_${idx}_name`}
                                value={member.name}
                                onChange={(e) => handleTeamMemberChange(idx, 'name', e.target.value)}
                                placeholder={`Full name of member #${idx + 2}`}
                                className={`w-full px-4 py-2 rounded-xl text-base sm:text-xs text-white bg-white/5 border outline-none transition-colors ${
                                  fieldErrors[`member_${idx}_name`]
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-white/10 focus:border-indigo-400'
                                }`}
                              />
                              {fieldErrors[`member_${idx}_name`] && (
                                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {fieldErrors[`member_${idx}_name`]}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Member Email & Phone */}
                          <div className="grid sm:grid-cols-2 gap-3">
                            {regFieldsConfig.email.enabled && (
                              <div>
                                <label className="block text-xs font-semibold mb-1 text-slate-300">
                                  {regFieldsConfig.email.label}{' '}
                                  {regFieldsConfig.email.required ? (
                                    <span className="text-red-400">*</span>
                                  ) : (
                                    '(Optional)'
                                  )}
                                </label>
                                <input
                                  type="email"
                                  inputMode="email"
                                  data-field-id={`member_${idx}_email`}
                                  value={member.email || ''}
                                  onChange={(e) =>
                                    handleTeamMemberChange(idx, 'email', e.target.value)
                                  }
                                  placeholder="member@email.com"
                                  className={`w-full px-4 py-2 rounded-xl text-base sm:text-xs text-white bg-white/5 border outline-none transition-colors ${
                                    fieldErrors[`member_${idx}_email`]
                                      ? 'border-red-400 focus:border-red-500'
                                      : 'border-white/10 focus:border-indigo-400'
                                  }`}
                                />
                                {fieldErrors[`member_${idx}_email`] && (
                                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {fieldErrors[`member_${idx}_email`]}
                                  </p>
                                )}
                              </div>
                            )}

                            {regFieldsConfig.phone.enabled && (
                              <div>
                                <label className="block text-xs font-semibold mb-1 text-slate-300">
                                  {regFieldsConfig.phone.label}{' '}
                                  {regFieldsConfig.phone.required ? (
                                    <span className="text-red-400">*</span>
                                  ) : (
                                    '(Optional)'
                                  )}
                                </label>
                                <input
                                  type="tel"
                                  inputMode="tel"
                                  data-field-id={`member_${idx}_phone`}
                                  value={member.phone || ''}
                                  onChange={(e) =>
                                    handleTeamMemberChange(idx, 'phone', e.target.value)
                                  }
                                  placeholder="10-digit number"
                                  className={`w-full px-4 py-2 rounded-xl text-base sm:text-xs text-white bg-white/5 border outline-none transition-colors ${
                                    fieldErrors[`member_${idx}_phone`]
                                      ? 'border-red-400 focus:border-red-500'
                                      : 'border-white/10 focus:border-indigo-400'
                                  }`}
                                />
                                {fieldErrors[`member_${idx}_phone`] && (
                                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {fieldErrors[`member_${idx}_phone`]}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Member College & Department */}
                          <div className="grid sm:grid-cols-2 gap-3">
                            {regFieldsConfig.college.enabled && (
                              <div>
                                <label className="block text-xs font-semibold mb-1 text-slate-300">
                                  {regFieldsConfig.college.label}{' '}
                                  {regFieldsConfig.college.required ? (
                                    <span className="text-red-400">*</span>
                                  ) : (
                                    '(Optional)'
                                  )}
                                </label>
                                <input
                                  type="text"
                                  data-field-id={`member_${idx}_college`}
                                  value={member.college || ''}
                                  onChange={(e) =>
                                    handleTeamMemberChange(idx, 'college', e.target.value)
                                  }
                                  placeholder="e.g. JSPM RSCOE"
                                  className={`w-full px-4 py-2 rounded-xl text-base sm:text-xs text-white bg-white/5 border outline-none transition-colors ${
                                    fieldErrors[`member_${idx}_college`]
                                      ? 'border-red-400 focus:border-red-500'
                                      : 'border-white/10 focus:border-indigo-400'
                                  }`}
                                />
                                {fieldErrors[`member_${idx}_college`] && (
                                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {fieldErrors[`member_${idx}_college`]}
                                  </p>
                                )}
                              </div>
                            )}

                            {regFieldsConfig.department.enabled && (
                              <div>
                                <label className="block text-xs font-semibold mb-1 text-slate-300">
                                  {regFieldsConfig.department.label}{' '}
                                  {regFieldsConfig.department.required ? (
                                    <span className="text-red-400">*</span>
                                  ) : (
                                    '(Optional)'
                                  )}
                                </label>
                                <input
                                  type="text"
                                  data-field-id={`member_${idx}_department`}
                                  value={member.department || ''}
                                  onChange={(e) =>
                                    handleTeamMemberChange(idx, 'department', e.target.value)
                                  }
                                  placeholder="e.g. IT"
                                  className={`w-full px-4 py-2 rounded-xl text-base sm:text-xs text-white bg-white/5 border outline-none transition-colors ${
                                    fieldErrors[`member_${idx}_department`]
                                      ? 'border-red-400 focus:border-red-500'
                                      : 'border-white/10 focus:border-indigo-400'
                                  }`}
                                />
                                {fieldErrors[`member_${idx}_department`] && (
                                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {fieldErrors[`member_${idx}_department`]}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Member Year of Study */}
                          {regFieldsConfig.year.enabled && (
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-slate-300">
                                {regFieldsConfig.year.label}{' '}
                                {regFieldsConfig.year.required ? (
                                  <span className="text-red-400">*</span>
                                ) : (
                                  '(Optional)'
                                )}
                              </label>
                              <select
                                data-field-id={`member_${idx}_year`}
                                value={member.year || ''}
                                onChange={(e) =>
                                  handleTeamMemberChange(idx, 'year', e.target.value)
                                }
                                className={`w-full px-4 py-2 rounded-xl text-base sm:text-xs text-white bg-slate-900 border outline-none transition-colors cursor-pointer ${
                                  fieldErrors[`member_${idx}_year`]
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-white/10 focus:border-indigo-400'
                                }`}
                                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                              >
                                <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                                  Select {regFieldsConfig.year.label}
                                </option>
                                <option value="1st Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                  1st Year
                                </option>
                                <option value="2nd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                  2nd Year
                                </option>
                                <option value="3rd Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                  3rd Year
                                </option>
                                <option value="4th Year" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                  4th Year
                                </option>
                                <option value="Postgraduate" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                  Postgraduate (PG)
                                </option>
                                <option value="Other" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                  Other
                                </option>
                              </select>
                              {fieldErrors[`member_${idx}_year`] && (
                                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {fieldErrors[`member_${idx}_year`]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment Section (if required) */}
                  {showPaymentQR && (
                    <div
                      ref={qrSectionRef}
                      data-field-id="paymentSection"
                      className="rounded-2xl border p-4 sm:p-6 space-y-5 my-4"
                      style={{
                        borderColor: 'rgba(59,130,246,0.35)',
                        background:
                          'linear-gradient(180deg, rgba(30,58,138,0.2) 0%, rgba(15,23,42,0.35) 100%)',
                        backdropFilter: 'blur(16px)',
                      }}
                    >
                      <div className="text-center space-y-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>UPI Registration Payment</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => scrollToQR(0)}
                            data-action="show-qr"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all cursor-pointer"
                            title="Scroll to QR"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Show QR</span>
                          </button>
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 justify-center flex-wrap">
                          Scan QR &amp; Pay via UPI
                          {selectedTier?.price !== undefined && (
                            <span className="text-emerald-400 font-mono font-extrabold px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm sm:text-base">
                              ₹{selectedTier.price}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-300 max-w-md mx-auto">
                          Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI app. Then upload your payment screenshot and enter the UTR below.
                        </p>
                      </div>

                      {/* QR Display */}
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative group p-3.5 sm:p-4 bg-white rounded-2xl shadow-2xl border border-blue-200/50 flex flex-col items-center max-w-full">
                          {qrImageStatus === 'loading' && (
                            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                              <p className="text-xs font-bold text-slate-800">Loading Payment QR</p>
                            </div>
                          )}

                          {qrImageStatus === 'error' && (
                            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                              <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                              <p className="text-xs font-bold text-slate-800">QR Code Failed to Display</p>
                              <div className="flex gap-2 mt-3">
                                <button
                                  type="button"
                                  onClick={handleManualQrRetry}
                                  className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Retry
                                </button>
                                {activePaymentQR && (
                                  <a
                                    href={activePaymentQR}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1 rounded bg-slate-200 text-slate-800 text-xs font-semibold"
                                  >
                                    Open
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          <img
                            src={currentQrSrc}
                            alt="Payment QR"
                            loading="eager"
                            onLoad={() => setQrImageStatus('loaded')}
                            onError={handleQrError}
                            className={`w-56 h-56 sm:w-64 sm:h-64 rounded-xl object-contain ${
                              qrImageStatus === 'loaded' ? 'block' : 'hidden'
                            }`}
                          />

                          {qrImageStatus === 'loaded' && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowFullQRModal(true)}
                                className="text-[11px] font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" /> Enlarge QR
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment Screenshot Upload */}
                      <div data-field-id="paymentScreenshot" className="space-y-2 text-left pt-2 border-t border-white/10">
                        <label className="block text-xs font-bold uppercase tracking-wider text-blue-300">
                          Upload Payment Screenshot <span className="text-red-400">*</span>
                        </label>

                        {!paymentScreenshotPreview ? (
                          <label className="border-2 border-dashed border-blue-400/30 hover:border-blue-400 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all bg-white/[0.02] hover:bg-white/[0.05]">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleScreenshotChange(e.target.files[0]);
                              }}
                            />
                            <UploadCloud className="w-7 h-7 text-blue-400 mb-1.5" />
                            <p className="text-xs font-semibold text-white">
                              Tap to upload payment screenshot
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Showing UPI Ref / UTR number &amp; amount (JPG, PNG, WebP)
                            </p>
                          </label>
                        ) : (
                          <div className="p-3 rounded-xl bg-black/40 border border-blue-500/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={paymentScreenshotPreview}
                                alt="Preview"
                                className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">
                                  {paymentScreenshotFile?.name || 'Payment_Proof.png'}
                                </p>
                                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Ready
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleScreenshotChange(null)}
                              className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 cursor-pointer"
                              title="Remove screenshot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {(fieldErrors.paymentScreenshot || paymentScreenshotError) && (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.paymentScreenshot || paymentScreenshotError}
                          </p>
                        )}
                      </div>

                      {/* UTR Input */}
                      <div className="space-y-1.5 pt-2 border-t border-white/10 text-left">
                        <label className="block text-xs font-bold uppercase tracking-wider text-blue-300">
                          UPI Transaction ID / UTR <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          data-field-id="transactionId"
                          value={transactionId}
                          onChange={(e) => {
                            setTransactionId(e.target.value);
                            if (fieldErrors.transactionId)
                              setFieldErrors((prev) => ({ ...prev, transactionId: '' }));
                          }}
                          placeholder="e.g. 425612349870"
                          className={`w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border font-mono tracking-wider outline-none transition-colors ${
                            fieldErrors.transactionId
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-white/10 focus:border-blue-400'
                          }`}
                        />
                        {fieldErrors.transactionId ? (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {fieldErrors.transactionId}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            12-digit UTR reference from your payment confirmation screen.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Domain Selection */}
                  {showDomainSelection && (
                    <div className="space-y-1.5 text-left">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Select Domain
                      </label>
                      <select
                        value={selectedDomainId}
                        onChange={(e) => setSelectedDomainId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-slate-900 border border-white/15 outline-none focus:border-blue-400 cursor-pointer"
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                      >
                        <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                          Choose domain (optional)
                        </option>
                        {event.participantDomains?.map((domain) => (
                          <option
                            key={domain.id}
                            value={domain.id}
                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          >
                            {domain.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Custom Questions from Builder */}
                  {applicableCustomFields.length > 0 && (
                    <div className="space-y-3.5 pt-3 border-t border-white/10 text-left">
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                        Additional Event Questions
                      </p>
                      {applicableCustomFields.map((field) => (
                        <div key={field.id}>
                          <label className="block text-xs font-semibold mb-1 text-slate-300">
                            {field.label}{' '}
                            {field.required ? (
                              <span className="text-red-400">*</span>
                            ) : (
                              '(Optional)'
                            )}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={customResponses[field.id] || ''}
                              onChange={(e) =>
                                setCustomResponses({
                                  ...customResponses,
                                  [field.id]: e.target.value,
                                })
                              }
                              placeholder={field.placeholder || `Enter ${field.label}`}
                              rows={3}
                              className="w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                            />
                          ) : field.type === 'select' ? (
                            <select
                              value={customResponses[field.id] || ''}
                              onChange={(e) =>
                                setCustomResponses({
                                  ...customResponses,
                                  [field.id]: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-slate-900 border border-white/15 outline-none focus:border-blue-400 cursor-pointer"
                              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                            >
                              <option
                                value=""
                                style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}
                              >
                                Select option...
                              </option>
                              {field.options?.map((opt) => (
                                <option
                                  key={opt}
                                  value={opt}
                                  style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                                >
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                field.type === 'number'
                                  ? 'number'
                                  : field.type === 'email'
                                  ? 'email'
                                  : 'text'
                              }
                              value={customResponses[field.id] || ''}
                              onChange={(e) =>
                                setCustomResponses({
                                  ...customResponses,
                                  [field.id]: e.target.value,
                                })
                              }
                              placeholder={field.placeholder || `Enter ${field.label}`}
                              className="w-full px-4 py-2.5 rounded-xl text-base sm:text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-blue-400"
                            />
                          )}
                          {fieldErrors[`custom_${field.id}`] && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {fieldErrors[`custom_${field.id}`]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submission and Navigation Buttons */}
                  <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                    {isMultiStep && (
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="w-full sm:w-auto px-5 py-3.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:bg-white/5 transition-all cursor-pointer text-center"
                      >
                        ← Back to Details
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold text-white text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:opacity-95 active:scale-[0.98]"
                      style={{
                        background: submitting
                          ? 'rgba(37,99,235,0.5)'
                          : 'linear-gradient(135deg, #2563eb, #1e40af)',
                      }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>
                            {paymentScreenshotFile
                              ? 'Uploading Proof & Issuing Pass...'
                              : 'Submitting Registration...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Ticket className="w-5 h-5" />
                          <span>Submit Registration &amp; Get Pass</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* ── NON-DISRUPTIVE RULES SIDE DRAWER / MODAL (Requirement #2 & #9) ────── */}
      {showRulesDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowRulesDrawer(false)}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slide-left p-5 sm:p-7 overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                    Rules &amp; Guidelines
                  </h3>
                  <span className="text-xs text-slate-400 block truncate max-w-[240px]">
                    {event.title}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesDrawer(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close rules drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note confirming form data safety */}
            <div className="p-2.5 mt-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-400" />
              <span>
                Your form information is safely preserved. You can close this drawer at any time.
              </span>
            </div>

            {/* Scrollable Rules Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {rulesContent}
            </div>

            {/* Official Rulebook link */}
            {event.rulebookUrl && (
              <div className="pt-3 pb-1 border-t border-white/10">
                <a
                  href={event.rulebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Download Official Rulebook PDF</span>
                </a>
              </div>
            )}

            {/* Close action */}
            <div className="pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRulesDrawer(false)}
                className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
              >
                Close &amp; Return to Registration Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENLARGED PAYMENT QR MODAL ────────────────────────────────────────── */}
      {showFullQRModal && activePaymentQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowFullQRModal(false)}
        >
          <div
            className="relative bg-slate-900 border border-slate-700/70 rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full text-center shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowFullQRModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                UPI Payment QR Code
              </h3>
              {selectedTier?.price !== undefined && (
                <p className="text-sm font-bold text-emerald-400 font-mono">
                  Amount: ₹{selectedTier.price}
                </p>
              )}
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl mx-auto max-w-full">
              <img
                src={currentQrSrc}
                alt="Enlarged Payment QR"
                className="w-72 h-72 sm:w-80 sm:h-80 max-w-full aspect-square object-contain mx-auto"
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>

            <p className="text-xs text-slate-300">
              Scan with Google Pay, PhonePe, Paytm, or any UPI app. Tap outside to return.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
