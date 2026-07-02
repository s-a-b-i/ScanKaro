import { AppSettings, DocumentItem, FolderItem, UserProfile } from '../../types';

export const MOCK_USER: UserProfile = {
  name: 'ScanKaro Pro',
  email: 'premium_user@example.com',
  plan: 'Pro - Annual Billing',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuABNZAGDm76xSrPVOSko7Gec3Fvt4nue07kiV8KUNpTdrjpurUq6A2zGkswUwKNCeMn84Zc35Y0p4Xgad55af8ei5KHJlugoJeGfOZLg18-jtqoawq_WtDe09uiLzzoKpHUScxgMw7HM5fxN3qsSy1W8ltnUPEWqEGqjabXrMFwFu_9cyHP-qkVVcjiDW7OrQ9gqlqigAl3BY61NuRDQ-wkBucQKVh61FlN3BM7ocB5lmzOWGVowhao-888CbS8ZJdjdnlfPR73N16a',
};

export const MOCK_SETTINGS: AppSettings = {
  biometricUnlock: true,
  stealthMode: false,
  darkMode: false,
  emailNotifications: true,
  googleDriveConnected: true,
  dropboxConnected: false,
};

export const MOCK_FOLDERS: FolderItem[] = [
  {
    id: 'personal',
    title: 'Personal',
    subtitle: 'ID Cards, Passport',
    count: 12,
    icon: 'person',
    color: 'bg-primary-container',
    iconColor: 'text-on-primary-container',
    folderIcon: 'folder',
  },
  {
    id: 'work',
    title: 'Work',
    subtitle: 'Contracts, Invoices',
    count: 45,
    icon: 'work',
    color: 'bg-tertiary-container',
    iconColor: 'text-on-tertiary-container',
    folderIcon: 'folder-special',
  },
  {
    id: 'study',
    title: 'Study',
    subtitle: 'Notes, Certificates',
    count: 8,
    icon: 'school',
    color: 'bg-secondary-container',
    iconColor: 'text-on-secondary-container',
    folderIcon: 'school',
  },
  {
    id: 'finance',
    title: 'Finance',
    subtitle: 'Tax, Receipts',
    count: 8,
    icon: 'account-balance',
    color: 'bg-error-container',
    iconColor: 'text-on-error-container',
    folderIcon: 'folder',
  },
];

export const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: '1',
    title: 'Office Lease Agreement',
    meta: 'May 24, 2024 • PDF',
    size: '2.4 MB',
    date: 'May 24, 2024',
    format: 'PDF',
    pages: 4,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBRzhNYGL3MJSPYxJmQHdg6OC0Gab23XRxIzHrUzSmt6LcaaW-b7wRw5hkddUW2ADKlHsdiKg83ifdoyvLl5zDORnGIVSmqLw0yrDUwj-dsKqKe7BN46jo2sK1K2BlUlZNlCA3wAXacK4P05J03w05ZBr1ung1__G0xJ2V1OSmCBogjJdj5KNo1__QkWsnodqvMwHoNPJxZkQSEgEMLvUWBKOvw9Tj6NUr5QL3xIlJy0DVflfWN2cHt6Yo0yf_7Te5mThstzg24C5t6',
    folderId: 'work',
    tags: ['WORK', 'SIGNED'],
    favorite: false,
  },
  {
    id: '2',
    title: 'Medical Receipt #442',
    meta: 'May 21, 2024 • JPG',
    size: '1.1 MB',
    date: 'May 21, 2024',
    format: 'JPG',
    pages: 1,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBESn6TS_0_vClzj9BKIE9Ot8MA7Jhq1OAtidgGpMtY4ov4mEsQDI-1MmuCboELxa0MoQ-9r80Uwbabgcb_xBQkMaFfR9PzwQ_7dDj_6kCaFWebq-BpHlmuycWeQGFiiNeFQY4fUs6SBPE6c6sPBQ37ObyeKGVkNYLJhAFX5eDlM4a36iJit4d2F_itQQ_G0dQSR7ElideA8yxn9Zfm_icRW4St7Xvl75Gdug0jK__JKk9VwGdDJUIbzAshWchijlP3UzkJZ3KeNW3o',
    folderId: 'finance',
    tags: ['HEALTH'],
    favorite: false,
  },
  {
    id: '3',
    title: 'Passport Scan 2024',
    meta: 'May 18, 2024 • PDF',
    size: '4.8 MB',
    date: 'May 18, 2024',
    format: 'PDF',
    pages: 2,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD6XbpKlPsyS_OFkB4mqsjQCYZjjRyIR-CF_pg3aqE_bEHtlqmw4Cmnv4w4mmhrr0K1g_LXX7UQf1Kf1iHXzKihIbi4uYAUGxE8Xi0UGs4dLaUcrIqm7bzWLZOoNWAVO7l-7SpppgMn5vXYa4IKv9eS9R0HDfuC5r_ymYn-OC-JxoYmS8JlHQUoKlP-_dK76WAxQGELtFA2LTvL3Nc-9Im1J4GkGS1QZAOvnZ4ko8QusR8a72ITqmuQowlUfIQcNbRA_Vc4d_ZbEFes',
    folderId: 'personal',
    tags: ['PERSONAL', 'ENCRYPTED'],
    favorite: true,
    encrypted: true,
  },
  {
    id: 'w1',
    title: 'Q3_Financial_Statement.pdf',
    meta: 'Oct 24 • 1.2 MB',
    size: '1.2 MB',
    date: 'Oct 24, 2024',
    format: 'PDF',
    pages: 4,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC0wzJ6CaZw143Xvk9VPJRzlLVWPP_OvK2AEIBfa5QkzO3NA1C9yFORpZ4x13YyXNTZeV8EDTuRN7CmPg1BnlM3PHb9ynQ_1JgND_K9j-BQO9S9k7cGPjFnOi372OFcOJrLiktowSvoXoXICJqzOpzCW966om6agirEXwhxyx0KeJvV-AUwvJH5a2TINsB71eI7jfFUDdjc9hM05MRPvdZ9gW0OWEkxZ_-0kgI-i3PoHereTj5WyyL6QcXvUWT336SffVF0qgJ3TTou',
    folderId: 'work',
    tags: ['WORK', 'FINANCE'],
    favorite: true,
  },
  {
    id: 'f1',
    title: 'Medical Receipt',
    meta: 'Oct 23 • 840 KB',
    size: '840 KB',
    date: 'Oct 23, 2024',
    format: 'PDF',
    pages: 1,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAwApiXeJ5US_rhHdIzHtk65JhaNDlh5sL_HLDy_0Rjuw2IVR45ylYC8A2StTV17JCV194-CR-szDo3QTWD_CrBNkE7Z2F4nc49LYKv94tjGFQnf_9QS0eFOyl67qno_uxawTzhWQdMVCjgqE4elHMJrepzDiMI7rAOk8xfZqlcZE7b7NzZDQkAlWFZVedPq-IFwoH4tefb0rt0Hzz4lNwbJVCWeZqZ4l1neUTnpjoWqs-7KczciIZ1wQoMceYYGx7FhjGqeoRBeciG',
    folderId: 'finance',
    tags: ['HEALTH'],
    favorite: true,
  },
];

export const DOCUMENT_PAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC1hoDadlXmHVNES4MdnjQYWEWCX9H3LL_HSjpGTcFvsnJIzX4sQuYaN7p7A6PUSuAS0TECnW5lQTA_A-uMFCSKCmqDzO4pHbLssBZmDkLoHFno0msNLhNvaw9X_c3QE5aEE7IZrXHsMurJ_gl2eBDeOCHQ2lyQk0P-QCHznhPy895ixV2fY8M1qS5Ii-pz4pBe_ya3v-R_GdkjssC1rFJV2xCzKL_vta2stQDfeJkfoU7ajRZN1b5Ohganfp4Xv4G0w3DRNcn6Hhlm',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCaLmQ-3gYlak-ttrVl1Tsis4mqfmnbY0UrWkjM116SECyz0UMfQx31XQEfp3laI2EW_OC4ZBPi8S_R0EQRMjgF2jsu3fXXxcIfWIIWwdibMUHjdCoFf0eFpCXqJWEwIuTZBzwdLY4fXeu0YWyj8uQBcQVXAv3olT6WWGmtkjcEFJNba_r6ckF8OxOAB6lhe6oaVFdKMIhiAmsZs4o3gDP5mnJ0RoFs8MmlbQzQ48CrhE5kdhBmH4Ifiose6nfbinoOXvLaAv5F9CBL',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD3aFAg007XoNl5f2LVknNsMpf_dxVOxNFuDfVec5HY-uAvwHIHIKWyDd3CRCm8V7rnh2Bcei7RoF0wxxZZG7AhQqYHY2hitZlFap1i0EZhC4MNSr3NYPLutVnvEDZiQ3CX9ILkb9iR7vjzGhCzmrkz2D-og_r3E6xqPIghtydwdtKP-Yl6epTQOiT8_NhhIs2hj64bvturYYfWvoxGUhQPE5_jnGWVgBci9YMU5IDl6KdfJ2HprmP8W0VOwhj5j7muGh7WpIYK_f32',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCNX47aurljwgKXYCxPrx55TDYu3RyUycthR-MgT9Ld2d4KbVImblci8KNEeRHkat_TuxwWG-4uGj8s3Uukkvwc-WpEGpj6UlkxPtt6Y101aAr1kxO3JR9KnZX6JLI3M9dH6fURyZ6i7pRW3hbPew2nchwxmpIqadUjv9dozEipI6rUE_GFGgCz0Ei8VLKKjnjq_WxTvURATcYY5HO58IwJxCrkI3AS5jCCHUBOeTu9Zj0Mz7cDYBEzXThEjQlF6cycVA0LPbLcT4Lp',
];

export const CROP_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAsf32TohihhlUQT9lztqMzoXx_cMWB4pKEZfvT7oI1sOQpYwYqpgeG3QB8SpellemHq1RkBjwy6t8XzzPSGXzqlZH27qv1Yh-w4kJFMMj7wTKbNCWeC33fhDTqR9rWMsBZ24zqt7XvOtqM8Xv-X1UH4x-H9u-iGZX9UUA8uK-KJrskye7nKAFYs6aw_-XL_xjHPQRH1PpFCUFfU6l_m4IFVacBZRzcnTlXHij7rYjjqdXJKRP-HiCrdu-E9sQGm6vPNkE1Tj3I91ym';

export const EXPORT_PREVIEW =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAtR2BdXb32QXngKTcjJOAJpSCVItJWzqBWcj3HNL4YgIaSNyQdIHedrwlTyPdvFBP0Z6LoHxn69xILwp2_mRZgVYanSDZbuude7SuraEtOhJ5ukBGcLFoRkyT0o6dj3z3stqkuKeG78QW_mydMSg4GapLZ9FAkxzzwsUeYFCFEbe27RKKjlIn1rbYXgBzfWjKObLc-9v5KWIaMDu-YszZQxgiseL6J6tbXrY48WcEx819jKnDjBKF5NZq-A1UyWranPE9_L8isYVM8';

export const OCR_TEXT = `QUARTERLY PERFORMANCE REPORT
Date: October 24, 2023
Project: Aurora Infrastructure
Status: On Track

SUMMARY
The Aurora Infrastructure project has surpassed its Phase 2 benchmarks by 14%. Current resource allocation remains optimized.

ACTION ITEMS
1. Verify server redundancy in Region 4.
2. Finalize contractual agreements with sub-contractors.
3. Schedule the synchronization meeting for Monday at 09:00 AM.`;

export const SCAN_THUMBNAILS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDdenFVmvkq1cmAo5gXeXRf-d7znPtY0IYfJEntqUpBIbAs_7_1dWyIO0ZVMV0Gnm5iaAW3gx5RzcyGMX5Nq8HPXHkvcbws00YtjDGearKW1oTn5GtqR_88pNfqH1xq0KKQS57X9WkpVcHWjse-UIlsVULibUrC20yPdGzMAJWpD76Z-McPx9iqh98QLGPoFnMmcAvVWLoELytdLg5ME56w_cMKYXUZgbzsfz3SizCRKiCS7tjQV62Crc-KaFcjIn3Z__clU9CweQHP',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0CEWz5lwBhAd1CypPa9A02JJvH9gsWH9W0wb49df5C9YaTKCSJbhidrt5RPcYQ6DWQxvk1xXbfRUb3EAMJMbmmmVeNRGHwyUGysUhS5-Nktfwr0tANMCjUL56VK3lXL4FM3HGH4JxHAcWTwO4ulrfUtIx0JS7vgI9SoKx9NWoOYtVwmW13UodmLIYRIyGpOgLopOM5vr-2A0F9gc_eU9M-WE_xGk8bq5VZnF5PVgI8t9JvS1gmGhVwNUadCcB8GTJm_3OcZZXAOoY',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDbLmZOqOYaQDFVkoCf-3LElrU3Lc1JEwI9XH_74tLtKsy7cx-sdBZxYl8yPE07j4fJrmA4vrbrPFT7WHUqqgreYJral6O1znKNVzkxU1rphZ5GusgnqswpEs4ErSc7cdDyxMVFp5NHWd71QffYl8NoiI1ka4lxzQaDRLk5B7YnZW_dKUYIaoGCB68CtoxFenoK35IdLOEO5RAacNqh7pGHxAwRKYCyyYs51CAczAGLkkPldttg6ImvMjTngq8_oOC9cmi7spN4bWbq',
];

export const CAMERA_PREVIEW =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBbYyhNKzVMz9dn3s7Yi0VlLBjyWjIKGvbRQmO0ZxO_-P8rb2Cw93s18yqGs035v53Vt0sKYAPYondlmpbG3rgjuC3nqoKbO8BGSRYYhdSe7QZCeWtxzdRzzYQZCiReS7uNU0QXK7k410t8O1aWVCAKKwNsO1RLDjwjyQKNVq1oIZGE3OVNrwWaJQftHYVEL_LP7c24XX9_7JVKJOGkFKFWBTL92XWW6LKg8_Gg03uIeElI4zWBlIbX8Cb6fBFOqIf_BFBBSHAP1Mh2';

export const PAYWALL_HERO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDWOCTrcF2MeJWYUCmS1bIrMax-zJgGVVoRmo3lflDEhQXgVLJFIIoMRcFWR8WDIXstUdCoOPHGUo4rQc6fgd5iJXQkHPaKWTenqPeBza5zVZyOS0ZimQXhV2E3L4B5yyZ0gPGj-gS3wVcYoSbEUMbgRXr81YK-xufcK5VorOc5Smr9cYJJizgXfvOxQoEzcxh6g0qY4bqIMADcIOxK2MRTUFsln1oh5HDQOkEgf7UQ4n2S6W4SgpfI99emjjCEjsBKqD7Tsj6nLZEa';

export const CROP_FILTERS = ['Auto', 'B&W', 'Color', 'Magic'];

export const ONBOARDING_SLIDES = [
  {
    id: 'scan',
    title: 'Scan documents instantly',
    description:
      'High-precision auto edge detection and perspective correction for crisp results every time.',
  },
  {
    id: 'ocr',
    title: 'Convert to searchable PDFs',
    description:
      'Extract text with advanced OCR technology to find your files by searching their content.',
  },
  {
    id: 'share',
    title: 'Organize & share securely',
    description:
      'E-sign documents, password protect sensitive files, and sync across all your devices.',
  },
];
