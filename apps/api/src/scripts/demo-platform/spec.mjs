// What the demo platform contains. Three organisations, each built by its own
// owner through the API.
const btech = (code, name) => ({ code, name, programs: [{ code: `BT${code}`, name: `B.Tech ${name}`, degreeType: 'ug', years: 4, sectionsY1: 2 }] });

export const ORGS = [
  {
    key: 'aranya',
    owner: 'cvdemo-aranya-owner@yopmail.com',
    type: 'university',
    domain: 'aranya.edu.in',
    campuses: [
      {
        name: 'Bengaluru Campus', code: 'ABLR', city: 'Bengaluru', state: 'Karnataka', pincode: '560100', address: 'Hosur Road, Electronic City',
        institutions: [
          { code: 'ASE', name: 'Aranya School of Engineering', kind: 'engineering', departments: [btech('CSE', 'Computer Science & Engineering'), btech('ECE', 'Electronics & Communication'), btech('ME', 'Mechanical Engineering')] },
          { code: 'ASM', name: 'Aranya School of Management', kind: 'management', departments: [{ code: 'MGT', name: 'Management Studies', programs: [{ code: 'MBA', name: 'MBA', degreeType: 'pg', years: 2 }, { code: 'BBA', name: 'BBA', degreeType: 'ug', years: 3 }] }] },
          { code: 'ASS', name: 'Aranya School of Sciences', kind: 'sciences', departments: [{ code: 'CA', name: 'Computer Applications', programs: [{ code: 'BCA', name: 'BCA', degreeType: 'ug', years: 3 }] }, { code: 'BIO', name: 'Biotechnology', programs: [{ code: 'BSCBT', name: 'B.Sc Biotechnology', degreeType: 'ug', years: 3 }] }] },
        ],
      },
      {
        name: 'Mysuru Campus', code: 'AMYS', city: 'Mysuru', state: 'Karnataka', pincode: '570006', address: 'Bannur Road, Hebbal',
        institutions: [
          { code: 'AIT', name: 'Aranya Institute of Technology', kind: 'engineering', departments: [btech('CSM', 'Computer Science'), btech('CIV', 'Civil Engineering')] },
          { code: 'ACC', name: 'Aranya College of Commerce', kind: 'commerce', departments: [{ code: 'COM', name: 'Commerce', programs: [{ code: 'BCOM', name: 'B.Com', degreeType: 'ug', years: 3 }, { code: 'MCOM', name: 'M.Com', degreeType: 'pg', years: 2 }] }] },
        ],
      },
    ],
  },
  {
    key: 'vedanta',
    owner: 'cvdemo-vedanta-owner@yopmail.com',
    type: 'university',
    domain: 'vedanta.edu.in',
    campuses: [
      {
        name: 'Pune Campus', code: 'VPUN', city: 'Pune', state: 'Maharashtra', pincode: '411057', address: 'Hinjewadi Phase 2',
        institutions: [
          { code: 'VCE', name: 'Vedanta College of Engineering', kind: 'engineering', departments: [btech('VCS', 'Computer Engineering'), btech('VIT', 'Information Technology'), btech('VME', 'Mechanical Engineering')] },
          { code: 'VCP', name: 'Vedanta College of Pharmacy', kind: 'pharmacy', departments: [{ code: 'PHA', name: 'Pharmaceutical Sciences', programs: [{ code: 'BPHARM', name: 'B.Pharm', degreeType: 'ug', years: 4 }, { code: 'MPHARM', name: 'M.Pharm', degreeType: 'pg', years: 2 }] }] },
          { code: 'VSL', name: 'Vedanta School of Law', kind: 'law', departments: [{ code: 'LAW', name: 'Law', programs: [{ code: 'BALLB', name: 'BA LLB', degreeType: 'ug', years: 5 }, { code: 'LLM', name: 'LLM', degreeType: 'pg', years: 1 }] }] },
        ],
      },
      {
        name: 'Nashik Campus', code: 'VNSK', city: 'Nashik', state: 'Maharashtra', pincode: '422013', address: 'Gangapur Road',
        institutions: [
          { code: 'VIE', name: 'Vedanta Institute of Engineering', kind: 'engineering', departments: [btech('NCS', 'Computer Science & Engineering'), btech('NEE', 'Electrical Engineering')] },
          { code: 'VSD', name: 'Vedanta School of Design', kind: 'design', departments: [{ code: 'DES', name: 'Design', programs: [{ code: 'BDES', name: 'B.Des', degreeType: 'ug', years: 4 }] }] },
        ],
      },
    ],
  },
  {
    key: 'sunrise',
    owner: 'cvdemo-sunrise-owner@yopmail.com',
    type: 'school',
    domain: 'sunriseschools.in',
    campuses: [
      { name: 'Indiranagar Campus', code: 'SIND', city: 'Bengaluru', state: 'Karnataka', pincode: '560038', address: '100 Feet Road, Indiranagar' },
      { name: 'Whitefield Campus', code: 'SWHF', city: 'Bengaluru', state: 'Karnataka', pincode: '560066', address: 'ITPL Main Road, Whitefield' },
      { name: 'HSR Layout Campus', code: 'SHSR', city: 'Bengaluru', state: 'Karnataka', pincode: '560102', address: '27th Main, HSR Layout Sector 1' },
    ],
    grades: 10,
    sectionsPerGrade: 2,
  },
];

// Subject catalogue per discipline, five per year.
const T = (names) => names;
export const SUBJECTS = {
  CSE: [T(['Engineering Mathematics I', 'Programming in C', 'Engineering Physics', 'Basic Electrical Engineering', 'Communication Skills']), T(['Data Structures', 'Discrete Mathematics', 'Digital Logic Design', 'Object Oriented Programming', 'Environmental Studies']), T(['Design & Analysis of Algorithms', 'Operating Systems', 'Database Management Systems', 'Computer Networks', 'Theory of Computation']), T(['Machine Learning', 'Cloud Computing', 'Compiler Design', 'Information Security', 'Software Engineering'])],
  ECE: [T(['Engineering Mathematics I', 'Basic Electronics', 'Engineering Physics', 'Programming in C', 'Communication Skills']), T(['Signals & Systems', 'Network Analysis', 'Electronic Devices', 'Digital Electronics', 'Environmental Studies']), T(['Analog Communication', 'Microprocessors', 'Control Systems', 'Electromagnetic Theory', 'Linear Integrated Circuits']), T(['VLSI Design', 'Digital Signal Processing', 'Wireless Communication', 'Embedded Systems', 'Optical Communication'])],
  ME: [T(['Engineering Mathematics I', 'Engineering Mechanics', 'Engineering Drawing', 'Engineering Chemistry', 'Workshop Practice']), T(['Thermodynamics', 'Strength of Materials', 'Manufacturing Processes', 'Material Science', 'Environmental Studies']), T(['Fluid Mechanics', 'Theory of Machines', 'Heat Transfer', 'Machine Design', 'Metrology']), T(['Automobile Engineering', 'Refrigeration & Air Conditioning', 'CAD/CAM', 'Industrial Engineering', 'Robotics'])],
  CIV: [T(['Engineering Mathematics I', 'Engineering Mechanics', 'Engineering Drawing', 'Engineering Chemistry', 'Communication Skills']), T(['Surveying', 'Building Materials', 'Fluid Mechanics', 'Strength of Materials', 'Environmental Studies']), T(['Structural Analysis', 'Geotechnical Engineering', 'Transportation Engineering', 'Concrete Technology', 'Hydrology']), T(['Design of Steel Structures', 'Construction Management', 'Environmental Engineering', 'Earthquake Engineering', 'Estimation & Costing'])],
  EE: [T(['Engineering Mathematics I', 'Basic Electrical Engineering', 'Engineering Physics', 'Programming in C', 'Communication Skills']), T(['Electrical Machines I', 'Network Theory', 'Electrical Measurements', 'Analog Electronics', 'Environmental Studies']), T(['Power Systems I', 'Control Systems', 'Power Electronics', 'Electrical Machines II', 'Microcontrollers']), T(['Power System Protection', 'High Voltage Engineering', 'Renewable Energy Systems', 'Electric Drives', 'Smart Grids'])],
  MBA: [T(['Managerial Economics', 'Financial Accounting', 'Organisational Behaviour', 'Marketing Management', 'Business Statistics']), T(['Strategic Management', 'Corporate Finance', 'Human Resource Management', 'Operations Management', 'Business Analytics'])],
  BBA: [T(['Principles of Management', 'Business Economics', 'Financial Accounting', 'Business Communication', 'Business Mathematics']), T(['Marketing Management', 'Cost Accounting', 'Human Resource Management', 'Business Law', 'Organisational Behaviour']), T(['Entrepreneurship', 'Financial Management', 'International Business', 'Digital Marketing', 'Strategic Management'])],
  BCA: [T(['Programming in C', 'Mathematics for Computing', 'Digital Fundamentals', 'Computer Organisation', 'English']), T(['Data Structures', 'Java Programming', 'Database Systems', 'Operating Systems', 'Web Technologies']), T(['Python Programming', 'Software Engineering', 'Computer Networks', 'Cloud Fundamentals', 'Project Work'])],
  BSCBT: [T(['Cell Biology', 'Biochemistry I', 'Chemistry', 'Mathematics & Statistics', 'English']), T(['Microbiology', 'Genetics', 'Molecular Biology', 'Biochemistry II', 'Environmental Studies']), T(['Genetic Engineering', 'Immunology', 'Bioprocess Technology', 'Bioinformatics', 'Plant Biotechnology'])],
  BCOM: [T(['Financial Accounting', 'Business Economics', 'Business Organisation', 'Business Mathematics', 'English']), T(['Corporate Accounting', 'Cost Accounting', 'Business Law', 'Income Tax', 'Banking']), T(['Management Accounting', 'Auditing', 'Financial Markets', 'GST & Customs', 'E-Commerce'])],
  MCOM: [T(['Advanced Financial Accounting', 'Managerial Economics', 'Research Methodology', 'Corporate Governance', 'Quantitative Techniques']), T(['Strategic Cost Management', 'International Finance', 'Direct Taxation', 'Investment Management', 'Dissertation'])],
  BPHARM: [T(['Human Anatomy & Physiology', 'Pharmaceutical Analysis', 'Pharmaceutics I', 'Pharmaceutical Inorganic Chemistry', 'Communication Skills']), T(['Pharmaceutical Organic Chemistry', 'Physical Pharmaceutics', 'Pharmaceutical Microbiology', 'Pathophysiology', 'Environmental Sciences']), T(['Medicinal Chemistry', 'Pharmacology I', 'Pharmacognosy', 'Industrial Pharmacy', 'Pharmaceutical Jurisprudence']), T(['Pharmacology II', 'Novel Drug Delivery', 'Biopharmaceutics', 'Pharmacy Practice', 'Quality Assurance'])],
  MPHARM: [T(['Modern Pharmaceutical Analysis', 'Drug Delivery Systems', 'Regulatory Affairs', 'Advanced Pharmaceutics', 'Research Methodology']), T(['Pharmaceutical Validation', 'Cosmetics & Cosmeceuticals', 'Herbal Technology', 'Clinical Research', 'Dissertation'])],
  BALLB: [T(['Legal Methods', 'Political Science I', 'Sociology', 'English & Legal Language', 'Law of Contract I']), T(['Constitutional Law I', 'Law of Torts', 'Family Law I', 'Political Science II', 'Economics']), T(['Criminal Law', 'Property Law', 'Jurisprudence', 'Administrative Law', 'Company Law']), T(['Civil Procedure Code', 'Evidence Law', 'Labour Law', 'Taxation Law', 'Environmental Law']), T(['Moot Court', 'Drafting & Pleading', 'International Law', 'Intellectual Property Law', 'Professional Ethics'])],
  LLM: [T(['Research Methods in Law', 'Comparative Public Law', 'Law & Justice in a Globalised World', 'Corporate Law', 'Dissertation'])],
  BDES: [T(['Design Fundamentals', 'Drawing & Sketching', 'Colour Theory', 'History of Design', 'Materials & Processes']), T(['Typography', 'Visual Communication', 'Form Studies', 'Digital Tools', 'Design Research']), T(['User Experience Design', 'Product Design', 'Interaction Design', 'Design Management', 'Portfolio I']), T(['Design Thesis', 'Service Design', 'Sustainable Design', 'Professional Practice', 'Portfolio II'])],
  SCHOOL: ['English', 'Hindi', 'Kannada', 'Mathematics', 'Science', 'Social Studies', 'Computer Science'],
};

/** Discipline key for a program's subject list. */
export function subjectKey(programCode) {
  if (/^BT/.test(programCode)) {
    const d = programCode.slice(2);
    return { CSE: 'CSE', CSM: 'CSE', VCS: 'CSE', VIT: 'CSE', NCS: 'CSE', ECE: 'ECE', ME: 'ME', VME: 'ME', CIV: 'CIV', NEE: 'EE' }[d];
  }
  return programCode;
}

export const STUDENTS_PER_SECTION = { university: 40, school: 34 };
