// How to say drug names. Written as sound-it-out syllables with the
// stressed syllable in CAPITALS (the voice gets them lowercased; the caps are
// for humans checking the list). Generic names only; brand names are left
// to the voice.
//
// Built from standard US pronunciations (pharmacist / USP-style). Not every
// entry is verified against a recording: if one sounds wrong, fix it in the
// Pronunciation lab and it overrides this list.

export const DRUGS: Record<string, string> = {
  // ---------- antidepressants ----------
  fluoxetine: 'floo-OX-uh-teen', sertraline: 'SER-truh-leen', paroxetine: 'puh-ROX-uh-teen', citalopram: 'sih-TAL-oh-pram',
  escitalopram: 'ess-sye-TAL-oh-pram', fluvoxamine: 'floo-VOX-uh-meen', venlafaxine: 'ven-luh-FAX-een',
  desvenlafaxine: 'dez-ven-luh-FAX-een', duloxetine: 'doo-LOX-uh-teen', levomilnacipran: 'lee-voh-mil-NAY-sih-pran',
  milnacipran: 'mil-NAY-sih-pran', bupropion: 'byoo-PRO-pee-on', mirtazapine: 'mur-TAZ-uh-peen', trazodone: 'TRAZ-oh-dohn',
  nefazodone: 'neh-FAZ-oh-dohn', vilazodone: 'vil-AZ-oh-dohn', vortioxetine: 'vor-tye-OX-uh-teen', amitriptyline: 'am-ee-TRIP-tih-leen',
  nortriptyline: 'nor-TRIP-tih-leen', imipramine: 'ih-MIP-ruh-meen', desipramine: 'dez-IP-ruh-meen', clomipramine: 'kloh-MIP-ruh-meen',
  doxepin: 'DOX-uh-pin', protriptyline: 'proh-TRIP-tih-leen', trimipramine: 'try-MIP-ruh-meen', amoxapine: 'uh-MOX-uh-peen',
  maprotiline: 'muh-PROH-tih-leen', phenelzine: 'FEN-el-zeen', tranylcypromine: 'tran-il-SIP-roh-meen',
  isocarboxazid: 'eye-soh-kar-BOX-uh-zid', selegiline: 'seh-LEDGE-ih-leen', esketamine: 'ess-KET-uh-meen', ketamine: 'KET-uh-meen',
  arketamine: 'ar-KET-uh-meen', brexanolone: 'brex-AN-oh-lohn', zuranolone: 'zur-AN-oh-lohn', gepirone: 'JEP-ih-rohn',
  dextromethorphan: 'dex-troh-meth-OR-fan', agomelatine: 'ag-oh-MEL-uh-teen', reboxetine: 'reh-BOX-uh-teen',
  buspirone: 'byoo-SPY-rohn', hydroxyzine: 'hy-DROX-ih-zeen', psilocybin: 'sy-loh-SY-bin', psilocin: 'SY-loh-sin',

  // ---------- antipsychotics ----------
  haloperidol: 'hal-oh-PAIR-ih-dol', chlorpromazine: 'klor-PROH-muh-zeen', fluphenazine: 'floo-FEN-uh-zeen',
  perphenazine: 'per-FEN-uh-zeen', thioridazine: 'thy-oh-RID-uh-zeen', thiothixene: 'thy-oh-THIX-een',
  trifluoperazine: 'try-floo-oh-PAIR-uh-zeen', loxapine: 'LOX-uh-peen', pimozide: 'PIM-oh-zide', molindone: 'moh-LIN-dohn',
  droperidol: 'droh-PAIR-ih-dol', prochlorperazine: 'proh-klor-PAIR-uh-zeen', clozapine: 'KLOH-zuh-peen',
  olanzapine: 'oh-LAN-zuh-peen', quetiapine: 'kweh-TY-uh-peen', risperidone: 'ris-PAIR-ih-dohn', paliperidone: 'pal-ee-PAIR-ih-dohn',
  ziprasidone: 'zih-PRAS-ih-dohn', aripiprazole: 'air-ih-PIP-ruh-zole', brexpiprazole: 'brex-PIP-ruh-zole',
  cariprazine: 'kair-IP-ruh-zeen', lurasidone: 'loo-RAS-ih-dohn', asenapine: 'uh-SEN-uh-peen', iloperidone: 'eye-loh-PAIR-ih-dohn',
  lumateperone: 'loo-muh-TEP-er-ohn', pimavanserin: 'pim-uh-VAN-ser-in', xanomeline: 'zan-OH-meh-leen', trospium: 'TROHS-pee-um',
  amisulpride: 'am-ee-SUL-pride', sulpiride: 'SUL-pih-ride', samidorphan: 'sam-ih-DOR-fan',

  // ---------- mood stabilizers / antiseizure ----------
  lithium: 'LITH-ee-um', valproate: 'val-PROH-ate', divalproex: 'dye-VAL-proh-ex', valproic: 'val-PROH-ik',
  carbamazepine: 'kar-buh-MAZ-uh-peen', oxcarbazepine: 'ox-kar-BAZ-uh-peen', lamotrigine: 'luh-MOH-trih-jeen',
  topiramate: 'toh-PEER-uh-mate', gabapentin: 'gab-uh-PEN-tin', pregabalin: 'preh-GAB-uh-lin', levetiracetam: 'lee-vuh-tye-RASS-uh-tam',
  phenytoin: 'FEN-ih-toyn', fosphenytoin: 'fos-FEN-ih-toyn', phenobarbital: 'fee-noh-BAR-bih-tal', ethosuximide: 'eth-oh-SUX-ih-mide',
  zonisamide: 'zoh-NIS-uh-mide', lacosamide: 'luh-KOH-suh-mide', clobazam: 'KLOH-buh-zam', primidone: 'PRIM-ih-dohn',
  tiagabine: 'tye-AG-uh-been', vigabatrin: 'vye-GAB-uh-trin', felbamate: 'FEL-buh-mate', cenobamate: 'sen-oh-BAM-ate',
  brivaracetam: 'briv-uh-RASS-uh-tam', perampanel: 'per-AM-puh-nel', rufinamide: 'roo-FIN-uh-mide',

  // ---------- benzodiazepines, hypnotics, anesthesia ----------
  alprazolam: 'al-PRAZ-oh-lam', lorazepam: 'lor-AZ-uh-pam', clonazepam: 'kloh-NAZ-uh-pam', diazepam: 'dye-AZ-uh-pam',
  chlordiazepoxide: 'klor-dye-az-uh-POX-ide', oxazepam: 'ox-AZ-uh-pam', temazepam: 'teh-MAZ-uh-pam', midazolam: 'mih-DAZ-oh-lam',
  triazolam: 'try-AZ-oh-lam', clorazepate: 'klor-AZ-uh-pate', flurazepam: 'floo-RAZ-uh-pam', estazolam: 'es-TAZ-oh-lam',
  flumazenil: 'floo-MAZ-uh-nil', zolpidem: 'ZOLE-pih-dem', zaleplon: 'ZAL-eh-plon', eszopiclone: 'ess-zoh-PIK-lohn',
  ramelteon: 'ruh-MEL-tee-on', suvorexant: 'soo-voh-REX-ant', lemborexant: 'lem-boh-REX-ant', daridorexant: 'dair-ih-doh-REX-ant',
  melatonin: 'mel-uh-TOH-nin', propofol: 'PROH-puh-fol', dexmedetomidine: 'dex-med-eh-TOM-ih-deen', etomidate: 'eh-TOM-ih-date',
  methohexital: 'meth-oh-HEX-ih-tal', succinylcholine: 'sux-in-il-KOH-leen', rocuronium: 'roh-kyoo-ROH-nee-um',
  vecuronium: 'vek-yoo-ROH-nee-um', sugammadex: 'soo-GAM-uh-dex', barbiturate: 'bar-BICH-er-it', benzodiazepine: 'ben-zoh-dye-AZ-uh-peen',
  benzodiazepines: 'ben-zoh-dye-AZ-uh-peenz',

  // ---------- ADHD, wakefulness ----------
  methylphenidate: 'meth-il-FEN-ih-date', dexmethylphenidate: 'dex-meth-il-FEN-ih-date', amphetamine: 'am-FET-uh-meen',
  dextroamphetamine: 'dex-troh-am-FET-uh-meen', lisdexamfetamine: 'lis-dex-am-FET-uh-meen', methamphetamine: 'meth-am-FET-uh-meen',
  atomoxetine: 'at-oh-MOX-uh-teen', viloxazine: 'vil-OX-uh-zeen', guanfacine: 'GWAN-fuh-seen', clonidine: 'KLON-ih-deen',
  modafinil: 'moh-DAF-ih-nil', armodafinil: 'ar-moh-DAF-ih-nil', solriamfetol: 'sol-ree-AM-feh-tol', pitolisant: 'pih-TOL-ih-sant',
  oxybate: 'OX-ee-bate',

  // ---------- dementia, movement, EPS ----------
  donepezil: 'doh-NEP-eh-zil', rivastigmine: 'riv-uh-STIG-meen', galantamine: 'guh-LAN-tuh-meen', memantine: 'MEM-an-teen',
  lecanemab: 'leh-KAN-eh-mab', donanemab: 'doh-NAN-eh-mab', aducanumab: 'add-yoo-KAN-yoo-mab', benztropine: 'BENZ-troh-peen',
  trihexyphenidyl: 'try-hex-ee-FEN-ih-dil', diphenhydramine: 'dye-fen-HY-druh-meen', amantadine: 'uh-MAN-tuh-deen',
  levodopa: 'lee-voh-DOH-puh', carbidopa: 'kar-bih-DOH-puh', pramipexole: 'pram-ih-PEX-ole', ropinirole: 'roh-PIN-ih-role',
  rasagiline: 'ruh-SAJ-ih-leen', entacapone: 'en-TAK-uh-pohn', tetrabenazine: 'tet-ruh-BEN-uh-zeen', valbenazine: 'val-BEN-uh-zeen',
  deutetrabenazine: 'doo-tet-ruh-BEN-uh-zeen', propranolol: 'proh-PRAN-oh-lol', dantrolene: 'DAN-troh-leen',
  bromocriptine: 'broh-moh-KRIP-teen', cyproheptadine: 'sye-proh-HEP-tuh-deen', riluzole: 'RIL-yoo-zole',

  // ---------- substance use, analgesics ----------
  naltrexone: 'nal-TREX-ohn', naloxone: 'nal-OX-ohn', nalmefene: 'NAL-meh-feen', buprenorphine: 'byoo-preh-NOR-feen',
  methadone: 'METH-uh-dohn', acamprosate: 'uh-KAM-proh-sate', disulfiram: 'dye-SUL-fih-ram', varenicline: 'vair-EN-ih-kleen',
  nicotine: 'NIK-oh-teen', lofexidine: 'loh-FEX-ih-deen', fentanyl: 'FEN-tuh-nil', morphine: 'MOR-feen', oxycodone: 'ox-ee-KOH-dohn',
  hydrocodone: 'hy-droh-KOH-dohn', hydromorphone: 'hy-droh-MOR-fohn', tramadol: 'TRAM-uh-dol', tapentadol: 'tuh-PEN-tuh-dol',
  codeine: 'KOH-deen', meperidine: 'meh-PAIR-ih-deen', phencyclidine: 'fen-SY-klih-deen', xylazine: 'ZY-luh-zeen',
  thiamine: 'THY-uh-min', baclofen: 'BAK-loh-fen', cannabidiol: 'kan-uh-buh-DY-ol', dronabinol: 'droh-NAB-ih-nol',
  ibogaine: 'IB-oh-gane', mescaline: 'MES-kuh-leen', cocaine: 'koh-KANE',
  acetaminophen: 'uh-see-tuh-MIN-oh-fen', ibuprofen: 'eye-byoo-PROH-fen', naproxen: 'nuh-PROX-en', ketorolac: 'KEE-toh-roh-lak',
  celecoxib: 'sel-eh-KOX-ib', meloxicam: 'meh-LOX-ih-kam', indomethacin: 'in-doh-METH-uh-sin', diclofenac: 'dye-KLOH-feh-nak',

  // ---------- inflammation, gout, steroids, lungs ----------
  colchicine: 'KOL-chih-seen', allopurinol: 'al-oh-PYOOR-ih-nol', febuxostat: 'feh-BUX-oh-stat', prednisone: 'PRED-nih-sohn',
  prednisolone: 'pred-NIS-oh-lohn', methylprednisolone: 'meth-il-pred-NIS-oh-lohn', dexamethasone: 'dex-uh-METH-uh-sohn',
  hydrocortisone: 'hy-droh-KOR-tih-sohn', fludrocortisone: 'floo-droh-KOR-tih-sohn', budesonide: 'byoo-DES-oh-nide',
  fluticasone: 'floo-TIK-uh-sohn', albuterol: 'al-BYOO-ter-ol', ipratropium: 'ip-ruh-TROH-pee-um', tiotropium: 'tye-oh-TROH-pee-um',
  salmeterol: 'sal-MEH-ter-ol', formoterol: 'for-MOH-ter-ol', montelukast: 'mon-teh-LOO-kast', theophylline: 'thee-OFF-ih-lin',

  // ---------- cardiovascular ----------
  lisinopril: 'lye-SIN-oh-pril', enalapril: 'eh-NAL-uh-pril', ramipril: 'RAM-ih-pril', captopril: 'KAP-toh-pril', benazepril: 'beh-NAZ-eh-pril',
  losartan: 'loh-SAR-tan', valsartan: 'val-SAR-tan', irbesartan: 'ir-beh-SAR-tan', candesartan: 'kan-deh-SAR-tan', olmesartan: 'ol-meh-SAR-tan',
  sacubitril: 'suh-KYOO-bih-tril', amlodipine: 'am-LOH-dih-peen', nifedipine: 'nye-FED-ih-peen', diltiazem: 'dil-TY-uh-zem',
  verapamil: 'ver-AP-uh-mil', metoprolol: 'meh-TOH-proh-lol', atenolol: 'uh-TEN-oh-lol', carvedilol: 'KAR-veh-dil-ol',
  labetalol: 'luh-BET-uh-lol', esmolol: 'EZ-moh-lol', nadolol: 'NAY-doh-lol', bisoprolol: 'bis-OH-proh-lol', pindolol: 'PIN-doh-lol',
  hydrochlorothiazide: 'hy-droh-klor-oh-THY-uh-zide', chlorthalidone: 'klor-THAL-ih-dohn', furosemide: 'fyoo-ROH-seh-mide',
  bumetanide: 'byoo-MET-uh-nide', torsemide: 'TOR-seh-mide', spironolactone: 'speer-oh-noh-LAK-tohn', eplerenone: 'eh-PLAIR-eh-nohn',
  triamterene: 'try-AM-ter-een', amiloride: 'uh-MIL-oh-ride', acetazolamide: 'uh-see-tuh-ZOL-uh-mide', mannitol: 'MAN-ih-tol',
  hydralazine: 'hy-DRAL-uh-zeen', minoxidil: 'mih-NOX-ih-dil', nitroglycerin: 'ny-troh-GLIS-er-in', isosorbide: 'eye-soh-SOR-bide',
  digoxin: 'dih-JOX-in', amiodarone: 'uh-MEE-oh-duh-rohn', dronedarone: 'droh-NED-uh-rohn', sotalol: 'SOH-tuh-lol',
  dofetilide: 'doh-FET-ih-lide', flecainide: 'FLEK-uh-nide', propafenone: 'proh-PAF-eh-nohn', adenosine: 'uh-DEN-oh-seen',
  lidocaine: 'LYE-doh-kane', procainamide: 'proh-KANE-uh-mide', atropine: 'AT-roh-peen', epinephrine: 'ep-ih-NEF-rin',
  norepinephrine: 'nor-ep-ih-NEF-rin', dopamine: 'DOH-puh-meen', dobutamine: 'doh-BYOO-tuh-meen', phenylephrine: 'fen-il-EF-rin',
  vasopressin: 'vay-soh-PRES-in', milrinone: 'MIL-rih-nohn', ivabradine: 'ih-VAB-ruh-deen', ranolazine: 'ruh-NOL-uh-zeen',
  prazosin: 'PRAY-zoh-sin', doxazosin: 'dox-AY-zoh-sin', terazosin: 'ter-AY-zoh-sin', quinidine: 'KWIN-ih-deen',
  atorvastatin: 'uh-tor-vuh-STAT-in', rosuvastatin: 'roh-soo-vuh-STAT-in', simvastatin: 'sim-vuh-STAT-in', pravastatin: 'prav-uh-STAT-in',
  lovastatin: 'loh-vuh-STAT-in', ezetimibe: 'eh-ZET-ih-mibe', fenofibrate: 'fen-oh-FY-brate', gemfibrozil: 'jem-FY-broh-zil',
  niacin: 'NY-uh-sin', evolocumab: 'ee-voh-LOK-yoo-mab', alirocumab: 'al-ih-ROK-yoo-mab',

  // ---------- blood ----------
  warfarin: 'WAR-fuh-rin', heparin: 'HEP-uh-rin', enoxaparin: 'ee-nox-uh-PAIR-in', apixaban: 'uh-PIX-uh-ban',
  rivaroxaban: 'riv-uh-ROX-uh-ban', dabigatran: 'duh-BIG-uh-tran', edoxaban: 'eh-DOX-uh-ban', fondaparinux: 'fon-duh-PAIR-ih-nux',
  argatroban: 'ar-GAT-roh-ban', bivalirudin: 'bye-val-ih-ROO-din', clopidogrel: 'kloh-PID-oh-grel', prasugrel: 'PRAS-oo-grel',
  ticagrelor: 'tye-KAG-reh-lor', alteplase: 'AL-teh-plase', tenecteplase: 'teh-NEK-teh-plase', tranexamic: 'tran-ex-AM-ik',
  protamine: 'PROH-tuh-meen', idarucizumab: 'eye-duh-roo-SIZ-oo-mab', andexanet: 'an-DEX-uh-net', cyanocobalamin: 'sye-an-oh-koh-BAL-uh-min',

  // ---------- endocrine ----------
  metformin: 'met-FOR-min', glipizide: 'GLIP-ih-zide', glyburide: 'GLY-byoo-ride', glimepiride: 'gly-MEP-ih-ride',
  pioglitazone: 'pye-oh-GLIT-uh-zohn', sitagliptin: 'sit-uh-GLIP-tin', linagliptin: 'lin-uh-GLIP-tin', empagliflozin: 'em-puh-glih-FLOH-zin',
  dapagliflozin: 'dap-uh-glih-FLOH-zin', canagliflozin: 'kan-uh-glih-FLOH-zin', semaglutide: 'sem-uh-GLOO-tide',
  liraglutide: 'leer-uh-GLOO-tide', dulaglutide: 'doo-luh-GLOO-tide', tirzepatide: 'teer-ZEP-uh-tide', exenatide: 'ex-EN-uh-tide',
  glargine: 'GLAR-jeen', detemir: 'DET-eh-meer', degludec: 'deh-GLOO-dek', lispro: 'LYE-sproh', levothyroxine: 'lee-voh-thy-ROX-een',
  liothyronine: 'lye-oh-THY-roh-neen', methimazole: 'meth-IM-uh-zole', propylthiouracil: 'proh-pil-thy-oh-YOOR-uh-sil',
  desmopressin: 'dez-moh-PRES-in', octreotide: 'ok-TREE-oh-tide', glucagon: 'GLOO-kuh-gon', alendronate: 'uh-LEN-droh-nate',
  denosumab: 'den-OH-soo-mab', estradiol: 'es-truh-DYE-ol', medroxyprogesterone: 'meh-drox-ee-proh-JES-teh-rohn',
  levonorgestrel: 'lee-voh-nor-JES-trel', norethindrone: 'nor-ETH-in-drohn', testosterone: 'tes-TOS-teh-rohn',
  clomiphene: 'KLOH-mih-feen', letrozole: 'LET-roh-zole', anastrozole: 'an-AS-troh-zole', tamoxifen: 'tuh-MOX-ih-fen',
  oxytocin: 'ox-ee-TOH-sin', methylergonovine: 'meth-il-er-goh-NOH-veen', terbutaline: 'ter-BYOO-tuh-leen',

  // ---------- GI, GU ----------
  omeprazole: 'oh-MEP-ruh-zole', esomeprazole: 'ess-oh-MEP-ruh-zole', pantoprazole: 'pan-TOH-pruh-zole',
  lansoprazole: 'lan-SOH-pruh-zole', famotidine: 'fuh-MOH-tih-deen', ranitidine: 'ruh-NIT-ih-deen', cimetidine: 'sye-MET-ih-deen',
  sucralfate: 'soo-KRAL-fate', misoprostol: 'mye-soh-PROS-tol', ondansetron: 'on-DAN-seh-tron', metoclopramide: 'met-oh-KLOH-pruh-mide',
  promethazine: 'proh-METH-uh-zeen', loperamide: 'loh-PAIR-uh-mide', lactulose: 'LAK-tyoo-lohs', rifaximin: 'rif-AX-ih-min',
  mesalamine: 'meh-SAL-uh-meen', sulfasalazine: 'sul-fuh-SAL-uh-zeen', infliximab: 'in-FLIX-ih-mab', adalimumab: 'ay-duh-LIM-yoo-mab',
  ursodiol: 'ur-soh-DYE-ol', tamsulosin: 'tam-SOO-loh-sin', finasteride: 'fin-AS-teh-ride', oxybutynin: 'ox-ee-BYOO-tih-nin',
  sildenafil: 'sil-DEN-uh-fil', tadalafil: 'tuh-DAL-uh-fil', meclizine: 'MEK-lih-zeen', scopolamine: 'skoh-POL-uh-meen',

  // ---------- infection ----------
  amoxicillin: 'uh-mox-ih-SIL-in', ampicillin: 'am-pih-SIL-in', penicillin: 'pen-ih-SIL-in', piperacillin: 'pye-PAIR-uh-sil-in',
  tazobactam: 'taz-oh-BAK-tam', nafcillin: 'naf-SIL-in', dicloxacillin: 'dye-klox-uh-SIL-in', cephalexin: 'sef-uh-LEX-in',
  cefazolin: 'sef-AZ-oh-lin', ceftriaxone: 'sef-try-AX-ohn', cefepime: 'SEF-eh-peem', cefuroxime: 'sef-yoor-OX-eem',
  ceftaroline: 'sef-TAR-oh-leen', meropenem: 'mair-oh-PEN-em', ertapenem: 'er-tuh-PEN-em', imipenem: 'im-ih-PEN-em',
  aztreonam: 'az-TREE-oh-nam', vancomycin: 'van-koh-MY-sin', linezolid: 'lih-NEZ-oh-lid', daptomycin: 'dap-toh-MY-sin',
  gentamicin: 'jen-tuh-MY-sin', tobramycin: 'toh-bruh-MY-sin', amikacin: 'am-ih-KAY-sin', azithromycin: 'uh-zith-roh-MY-sin',
  clarithromycin: 'kluh-rith-roh-MY-sin', erythromycin: 'eh-rith-roh-MY-sin', doxycycline: 'dox-ih-SY-kleen',
  minocycline: 'min-oh-SY-kleen', tetracycline: 'tet-ruh-SY-kleen', ciprofloxacin: 'sip-roh-FLOX-uh-sin',
  levofloxacin: 'lee-voh-FLOX-uh-sin', moxifloxacin: 'mox-ih-FLOX-uh-sin', trimethoprim: 'try-METH-oh-prim',
  sulfamethoxazole: 'sul-fuh-meth-OX-uh-zole', nitrofurantoin: 'ny-troh-fyoor-AN-toyn', metronidazole: 'meh-troh-NY-duh-zole',
  clindamycin: 'klin-duh-MY-sin', rifampin: 'RIF-am-pin', isoniazid: 'eye-soh-NY-uh-zid', pyrazinamide: 'peer-uh-ZIN-uh-mide',
  ethambutol: 'eth-AM-byoo-tol', fluconazole: 'floo-KON-uh-zole', itraconazole: 'it-ruh-KON-uh-zole', voriconazole: 'vor-ih-KON-uh-zole',
  ketoconazole: 'kee-toh-KON-uh-zole', amphotericin: 'am-foh-TAIR-ih-sin', nystatin: 'NYE-stat-in', micafungin: 'my-kuh-FUN-jin',
  acyclovir: 'ay-SY-kloh-veer', valacyclovir: 'val-ay-SY-kloh-veer', ganciclovir: 'gan-SY-kloh-veer', oseltamivir: 'oh-sel-TAM-ih-veer',
  remdesivir: 'rem-DES-ih-veer', nirmatrelvir: 'neer-muh-TREL-veer', ritonavir: 'rih-TOH-nuh-veer', tenofovir: 'teh-NOH-foh-veer',
  emtricitabine: 'em-try-SIT-uh-been', dolutegravir: 'doh-loo-TEG-ruh-veer', bictegravir: 'bik-TEG-ruh-veer', efavirenz: 'eh-FAV-ih-renz',
  zidovudine: 'zye-DOH-vyoo-deen', lamivudine: 'luh-MIV-yoo-deen', abacavir: 'uh-BAK-uh-veer', hydroxychloroquine: 'hy-drox-ee-KLOR-oh-kwin',
  ivermectin: 'eye-ver-MEK-tin', permethrin: 'per-METH-rin',

  // ---------- immune, oncology ----------
  methotrexate: 'meth-oh-TREX-ate', azathioprine: 'az-uh-THY-oh-preen', mycophenolate: 'my-koh-FEN-oh-late', tacrolimus: 'tuh-KROH-lih-mus',
  cyclosporine: 'sye-kloh-SPOR-een', sirolimus: 'sih-ROH-lih-mus', cyclophosphamide: 'sye-kloh-FOS-fuh-mide', rituximab: 'rih-TUX-ih-mab',
  etanercept: 'eh-TAN-er-sept', vincristine: 'vin-KRIS-teen', cisplatin: 'sis-PLAT-in', doxorubicin: 'dox-oh-ROO-bih-sin',
  pembrolizumab: 'pem-broh-LIZ-oo-mab', nivolumab: 'nye-VOL-yoo-mab', trastuzumab: 'tras-TOO-zoo-mab', bevacizumab: 'beh-vuh-SIZ-oo-mab',
  imatinib: 'ih-MAT-ih-nib',

  // ---------- everything else common ----------
  cyclobenzaprine: 'sye-kloh-BEN-zuh-preen', tizanidine: 'tye-ZAN-ih-deen', methocarbamol: 'meth-oh-KAR-buh-mol',
  sumatriptan: 'soo-muh-TRIP-tan', rizatriptan: 'rye-zuh-TRIP-tan', ubrogepant: 'yoo-BROH-jeh-pant', rimegepant: 'rih-MEJ-eh-pant',
  erenumab: 'eh-REN-yoo-mab', loratadine: 'lor-AT-uh-deen', cetirizine: 'seh-TEER-ih-zeen', fexofenadine: 'fex-oh-FEN-uh-deen',
  pseudoephedrine: 'soo-doh-eh-FED-rin', guaifenesin: 'gwye-FEN-eh-sin', benzonatate: 'ben-ZOH-nuh-tate', physostigmine: 'fye-soh-STIG-meen',
  pyridostigmine: 'peer-ih-doh-STIG-meen', neostigmine: 'nee-oh-STIG-meen', glycopyrrolate: 'gly-koh-PEER-oh-late',
  fomepizole: 'foh-MEP-ih-zole', deferoxamine: 'deh-fer-OX-uh-meen', acetylcysteine: 'uh-see-til-SIS-teen', isotretinoin: 'eye-soh-TRET-ih-noyn',
  tretinoin: 'TRET-ih-noyn', quinine: 'KWY-nine',
};

/** Respelling as the voice should get it: "air-ih-PIP-ruh-zole" -> "air-ih-pip-ruh-zole" or spaced. */
export function renderRespelling(r: string, style: 'hyphen' | 'spaced' = 'hyphen'): string {
  const lower = r.toLowerCase();
  return style === 'spaced' ? lower.replace(/-/g, ' ') : lower;
}

/** Look up a drug token (any case; simple plurals and possessives). */
export function lookupDrug(tok: string): string | null {
  const t = tok.toLowerCase();
  if (t in DRUGS) return DRUGS[t];
  const bare = t.replace(/'s$/, '').replace(/s$/, '');
  if (bare !== t && bare in DRUGS) return DRUGS[bare] + 's';
  return null;
}
