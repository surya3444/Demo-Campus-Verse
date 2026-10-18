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
  {
    key: 'marian',
    owner: 'owner@marianeducity.org',
    type: 'university',
    domain: 'marianeducity.org',
    names: 'kerala',
    campuses: [
      {
        name: 'Marian EduCity', code: 'MEDC', city: 'Thiruvananthapuram', state: 'Kerala', pincode: '695582', address: 'Menamkulam, Kazhakuttam',
        institutions: [
          {
            code: 'MEC', name: 'Marian Engineering College', kind: 'engineering',
            departments: [
              { code: 'CE', name: 'Civil Engineering', programs: [{ code: 'BTCE', name: 'B.Tech Civil Engineering', degreeType: 'ug', years: 4 }, { code: 'MTGT', name: 'M.Tech Geotechnical Engineering', degreeType: 'pg', years: 2 }] },
              { code: 'CSE', name: 'Computer Science & Engineering', programs: [{ code: 'BTCSE', name: 'B.Tech Computer Science & Engineering', degreeType: 'ug', years: 4, sectionsY1: 2 }] },
              { code: 'EEE', name: 'Electrical & Electronics Engineering', programs: [{ code: 'BTEEE', name: 'B.Tech Electrical & Electronics Engineering', degreeType: 'ug', years: 4 }] },
              { code: 'ECE', name: 'Electronics & Communication Engineering', programs: [{ code: 'BTECE', name: 'B.Tech Electronics & Communication Engineering', degreeType: 'ug', years: 4 }] },
              { code: 'ME', name: 'Mechanical Engineering', programs: [{ code: 'BTME', name: 'B.Tech Mechanical Engineering', degreeType: 'ug', years: 4 }] },
              { code: 'AIML', name: 'Artificial Intelligence & Machine Learning', programs: [{ code: 'BTAIML', name: 'B.Tech Artificial Intelligence & Machine Learning', degreeType: 'ug', years: 4 }] },
              { code: 'ECM', name: 'Electronics & Computer Engineering', programs: [{ code: 'BTECM', name: 'B.Tech Electronics & Computer Engineering', degreeType: 'ug', years: 4 }] },
              { code: 'ELC', name: 'Electrical & Computer Engineering', programs: [{ code: 'BTELC', name: 'B.Tech Electrical & Computer Engineering', degreeType: 'ug', years: 4 }] },
              { code: 'MGMT', name: 'Management', programs: [{ code: 'MBAE', name: 'Master of Business Administration (MBA)', degreeType: 'pg', years: 2 }] },
              { code: 'CAPP', name: 'Computer Applications', programs: [{ code: 'IMCA', name: 'Integrated Master of Computer Applications (MCA)', degreeType: 'pg', years: 5 }] },
            ],
          },
          { code: 'MSD', name: 'Marian School of Design', kind: 'design', departments: [{ code: 'DES', name: 'Design', programs: [{ code: 'BDES', name: 'Bachelor of Design (B.Des)', degreeType: 'ug', years: 4 }] }] },
          { code: 'MBS', name: 'Marian Business School', kind: 'management', departments: [{ code: 'MS', name: 'Management Studies', programs: [{ code: 'MBA', name: 'Master of Business Administration (MBA)', degreeType: 'pg', years: 2, sectionsY1: 2 }] }] },
          {
            code: 'MCAS', name: 'Marian College of Arts & Science', kind: 'sciences',
            departments: [
              { code: 'COM', name: 'Commerce', programs: [{ code: 'BCOMBIS', name: 'B.Com Business Information Systems', degreeType: 'ug', years: 3 }, { code: 'MCOM', name: 'Master of Commerce (M.Com)', degreeType: 'pg', years: 2 }] },
              { code: 'ENG', name: 'English / Humanities', programs: [{ code: 'BAENG', name: 'BA English Language & Literature', degreeType: 'ug', years: 3 }] },
              { code: 'BA', name: 'Business Administration', programs: [{ code: 'BBALSCM', name: 'BBA Logistics & Supply Chain Management', degreeType: 'ug', years: 3 }] },
              { code: 'LS', name: 'Life Sciences', programs: [{ code: 'BSCZOO', name: 'B.Sc Zoology', degreeType: 'ug', years: 3 }] },
              { code: 'GEO', name: 'Geography', programs: [{ code: 'BSCGEO', name: 'B.Sc Geography', degreeType: 'ug', years: 3 }] },
              { code: 'CS', name: 'Computer Science', programs: [{ code: 'BSCCS', name: 'B.Sc Computer Science', degreeType: 'ug', years: 3 }] },
            ],
          },
          {
            code: 'MCAP', name: 'Marian College of Architecture & Planning', kind: 'architecture',
            departments: [
              { code: 'ARCH', name: 'Architecture', programs: [{ code: 'BARCH', name: 'Bachelor of Architecture (B.Arch)', degreeType: 'ug', years: 5 }] },
              { code: 'ADES', name: 'Design – Architecture & Planning', programs: [{ code: 'BDESA', name: 'Bachelor of Design (B.Des)', degreeType: 'ug', years: 4 }] },
            ],
          },
          {
            code: 'MCACE', name: 'Marian Craft and Arts Centre of Excellence', kind: 'arts',
            departments: [
              { code: 'CRAFT', name: 'Crafts', programs: [{ code: 'DIPCR', name: 'Diploma in Crafts', degreeType: 'diploma', years: 1 }] },
              { code: 'AART', name: 'Applied Arts', programs: [{ code: 'DIPAA', name: 'Diploma in Applied Arts', degreeType: 'diploma', years: 1 }] },
            ],
          },
          { code: 'SJTC', name: "St. Jacob's Training College", kind: 'education', departments: [{ code: 'TED', name: 'Teacher Education', programs: [{ code: 'BED', name: 'Bachelor of Education (B.Ed)', degreeType: 'ug', years: 2 }] }] },
          { code: 'MSCA', name: 'Marian School of Computer Application', kind: 'computing', departments: [{ code: 'MCAD', name: 'Computer Applications (MSCA)', programs: [{ code: 'MCA', name: 'Master of Computer Applications (MCA)', degreeType: 'pg', years: 2 }] }] },
        ],
      },
    ],
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
  AIML: [T(['Engineering Mathematics I', 'Programming in Python', 'Engineering Physics', 'Basic Electrical Engineering', 'Communication Skills']), T(['Data Structures', 'Probability & Statistics', 'Linear Algebra for AI', 'Object Oriented Programming', 'Environmental Studies']), T(['Machine Learning', 'Artificial Intelligence', 'Database Management Systems', 'Operating Systems', 'Computer Networks']), T(['Deep Learning', 'Natural Language Processing', 'Computer Vision', 'Reinforcement Learning', 'MLOps & Deployment'])],
  ECM: [T(['Engineering Mathematics I', 'Basic Electronics', 'Programming in C', 'Engineering Physics', 'Communication Skills']), T(['Digital Electronics', 'Data Structures', 'Signals & Systems', 'Computer Organisation', 'Environmental Studies']), T(['Microprocessors & Microcontrollers', 'Embedded Systems', 'Operating Systems', 'Computer Networks', 'VLSI Design']), T(['Internet of Things', 'Embedded Linux', 'Digital Signal Processing', 'Hardware Security', 'Edge Computing'])],
  ELC: [T(['Engineering Mathematics I', 'Basic Electrical Engineering', 'Programming in C', 'Engineering Physics', 'Communication Skills']), T(['Electric Circuits', 'Data Structures', 'Electrical Machines', 'Digital Systems', 'Environmental Studies']), T(['Power Electronics', 'Control Systems', 'Computer Architecture', 'Power Systems', 'Microcontrollers']), T(['Smart Grid Computing', 'Electric Vehicles', 'Industrial Automation & PLC', 'Machine Learning for Power Systems', 'Cyber-Physical Systems'])],
  MTGT: [T(['Advanced Soil Mechanics', 'Foundation Engineering', 'Rock Mechanics', 'Ground Improvement Techniques', 'Research Methodology']), T(['Earth & Rockfill Dams', 'Geotechnical Earthquake Engineering', 'Finite Element Methods in Geomechanics', 'Slope Stability Analysis', 'Dissertation'])],
  IMCA: [T(['Programming in C', 'Discrete Mathematics', 'Digital Fundamentals', 'Computer Organisation', 'English']), T(['Data Structures', 'Java Programming', 'Database Systems', 'Operating Systems', 'Web Technologies']), T(['Python Programming', 'Software Engineering', 'Computer Networks', 'Design & Analysis of Algorithms', 'Data Mining']), T(['Machine Learning', 'Cloud Computing', 'Mobile Application Development', 'Information Security', 'Big Data Analytics']), T(['Deep Learning', 'DevOps', 'Blockchain Technologies', 'Research Methodology', 'Major Project'])],
  MCA: [T(['Advanced Data Structures', 'Object Oriented Programming in Java', 'Database Management Systems', 'Mathematical Foundations of Computing', 'Digital Fundamentals & Architecture']), T(['Machine Learning', 'Cloud Computing', 'Web Programming', 'Software Project Management', 'Major Project'])],
  BCOMBIS: [T(['Financial Accounting', 'Fundamentals of Information Systems', 'Business Management', 'Business Statistics', 'English']), T(['Corporate Accounting', 'Database Management for Business', 'Cost Accounting', 'E-Business & Web Design', 'Business Law']), T(['Management Accounting', 'Enterprise Resource Planning', 'Business Analytics', 'Income Tax', 'Project Work'])],
  BAENG: [T(['Reading Poetry', 'Methodology of Literary Studies', 'Indian Writing in English', 'Communication Skills in English', 'Malayalam I']), T(['Reading Fiction', 'Modes of Writing', 'British Literature: Chaucer to Shakespeare', 'Literary Criticism', 'Malayalam II']), T(['Postcolonial Literatures', 'Women Writing', 'American Literature', 'Film Studies', 'Literary Theory'])],
  BBALSCM: [T(['Principles of Management', 'Introduction to Logistics', 'Business Economics', 'Financial Accounting', 'Business Communication']), T(['Supply Chain Management', 'Warehousing & Inventory Management', 'Transportation Management', 'Marketing Management', 'Business Law']), T(['Shipping & Port Management', 'Global Logistics', 'Procurement & Sourcing', 'Logistics Information Systems', 'Project Work'])],
  BSCZOO: [T(['Animal Diversity: Non-Chordata', 'Cell Biology', 'Chemistry I', 'Mathematics for Life Sciences', 'English']), T(['Animal Diversity: Chordata', 'Genetics', 'Biochemistry', 'Physiology', 'Environmental Studies']), T(['Developmental Biology', 'Immunology', 'Evolution & Ethology', 'Applied Zoology', 'Biotechnology & Bioinformatics'])],
  BSCGEO: [T(['Physical Geography', 'Cartography I', 'Geomorphology', 'Mathematics for Geography', 'English']), T(['Climatology', 'Human Geography', 'Cartography II', 'Oceanography', 'Environmental Studies']), T(['Remote Sensing', 'Geographic Information Systems', 'Regional Planning', 'Geography of India & Kerala', 'Field Survey Project'])],
  BSCCS: [T(['Programming in C', 'Discrete Mathematics', 'Digital Fundamentals', 'Computer Organisation', 'English']), T(['Data Structures', 'Object Oriented Programming with Java', 'Database Management Systems', 'Operating Systems', 'Environmental Studies']), T(['Python Programming', 'Computer Networks', 'Software Engineering', 'Web Technologies', 'Project Work'])],
  BARCH: [T(['Architectural Design I', 'Building Materials & Construction I', 'Architectural Drawing', 'History of Architecture I', 'Basic Design']), T(['Architectural Design II', 'Building Construction II', 'Structures I', 'History of Architecture II', 'Climatology']), T(['Architectural Design III', 'Building Services', 'Structures II', 'Landscape Architecture', 'Computer Aided Design']), T(['Architectural Design IV', 'Urban Design', 'Housing', 'Estimation & Specification', 'Vernacular Architecture of Kerala']), T(['Architectural Thesis', 'Professional Practice', 'Town Planning', 'Project Management', 'Practical Training'])],
  DIPCR: [T(['Traditional Kerala Crafts', 'Bamboo & Cane Work', 'Coir Craft', 'Wood Carving', 'Craft Entrepreneurship'])],
  DIPAA: [T(['Drawing & Painting', 'Mural Painting', 'Graphic Design', 'Photography', 'Portfolio Development'])],
  BED: [T(['Childhood & Growing Up', 'Contemporary India & Education', 'Learning & Teaching', 'Language Across the Curriculum', 'Pedagogy of School Subjects I']), T(['Knowledge & Curriculum', 'Assessment for Learning', 'Creating an Inclusive School', 'Pedagogy of School Subjects II', 'School Internship'])],
  SCHOOL: ['English', 'Hindi', 'Kannada', 'Mathematics', 'Science', 'Social Studies', 'Computer Science'],
};

/** Discipline key for a program's subject list. */
export function subjectKey(programCode) {
  if (/^BT/.test(programCode)) {
    const d = programCode.slice(2);
    return { CSE: 'CSE', CSM: 'CSE', VCS: 'CSE', VIT: 'CSE', NCS: 'CSE', ECE: 'ECE', ME: 'ME', VME: 'ME', CIV: 'CIV', NEE: 'EE', CE: 'CIV', EEE: 'EE', AIML: 'AIML', ECM: 'ECM', ELC: 'ELC' }[d];
  }
  return { MBAE: 'MBA', BDESA: 'BDES' }[programCode] ?? programCode;
}

export const STUDENTS_PER_SECTION = { university: 40, school: 34 };
