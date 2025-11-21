import { IgcseSubjectKey } from './types';

export interface Chapter {
  name: string;
  subtopics: string[];
}

// Data for subjects that have MCQ papers, structured by chapters and subtopics.
export const SUBJECT_TOPICS: { [key in IgcseSubjectKey]?: Chapter[] } = {
  physics_p2: [
    { name: '1. General Physics', subtopics: ['Length and time', 'Motion', 'Mass and weight', 'Density', 'Forces', 'Energy, work and power', 'Pressure'] },
    { name: '2. Thermal Physics', subtopics: ['Simple kinetic molecular model of matter', 'Thermal properties and temperature', 'Thermal processes (Conduction, Convection and Radiation)'] },
    { name: '3. Properties of waves, including light and sound', subtopics: ['General wave properties', 'Light', 'Sound'] },
    { name: '4. Electricity and Magnetism', subtopics: ['Simple phenomena of magnetism', 'Electrical quantities', 'Electric circuits', 'Dangers of electricity', 'Electromagnetic effects'] },
    { name: '5. Atomic Physics', subtopics: ['The nuclear atom', 'Radioactivity'] }
  ],
  chemistry_p2: [
    { name: '1. The particulate nature of matter', subtopics: ['Kinetic particle theory', 'Atomic structure', 'Structure and bonding'] },
    { name: '2. Experimental techniques', subtopics: ['Measurement', 'Purity', 'Separating mixtures'] },
    { name: '3. Atoms, elements and compounds', subtopics: ['Physical and chemical changes', 'Elements, compounds and mixtures', 'Periodic Table', 'Metals', 'Air and water'] },
    { name: '4. Stoichiometry', subtopics: ['The mole concept', 'Chemical formulae and equations'] },
    { name: '5. Electricity and chemistry', subtopics: ['Electrolysis'] },
    { name: '6. Chemical energetics', subtopics: ['Energetics of a reaction', 'Energy transfer'] },
    { name: '7. Chemical reactions', subtopics: ['Rate of reaction', 'Reversible reactions', 'Redox'] },
    { name: '8. Acids, bases and salts', subtopics: ['The characteristic properties of acids and bases', 'Types of oxides', 'Preparation of salts', 'Identification of ions and gases'] },
    { name: '9. The Periodic Table', subtopics: ['Arrangement of elements', 'Group properties', 'Transition elements'] },
    { name: '10. Metals', subtopics: ['Properties of metals', 'Reactivity series', 'Extraction of metals', 'Uses of metals'] },
    { name: '11. Organic chemistry', subtopics: ['Names of compounds', 'Fuels', 'Alkanes', 'Alkenes', 'Alcohols', 'Carboxylic acids', 'Polymers'] }
  ],
  cs_p1: [
      { name: '1. Data representation', subtopics: ['Binary systems', 'Hexadecimal', 'Data storage'] },
      { name: '2. Communication and Internet technologies', subtopics: ['Data transmission', 'Security aspects', 'Internet principles of operation'] },
      { name: '3. Hardware and software', subtopics: ['Logic gates', 'Computer architecture', 'Input and output devices', 'Memory, storage devices and media', 'Operating systems', 'High- and low-level languages and their translators'] },
      { name: '4. Security', subtopics: ['Security, privacy and data integrity'] },
      { name: '5. Ethics', subtopics: ['Ethics and ownership'] },
      { name: '6. Databases', subtopics: ['Database management systems'] }
  ],
  islamiyat_p1: [
      { name: 'Major themes of the Qur’an', subtopics: ['God in Himself', 'God’s relationship with the created world', 'God’s Messengers'] },
      { name: 'The history and importance of the Qur’an', subtopics: ['Revelation of the Qur’an', 'Compilation of the Qur’an', 'Structure and content', 'Major themes', 'Use in everyday life'] },
      { name: 'The life and importance of the Prophet Muhammad (pbuh)', subtopics: ['Background', 'Life in Makka', 'Life in Madina', 'The Wives of the Prophet', 'The Descendants of the Prophet'] },
      { name: 'The first Islamic community', subtopics: ['The Four Rightly Guided Caliphs', 'The ‘Ten Blessed Companions’'] }
  ],
  pak_studies_p1: [
      { name: 'Cultural and historical background to the Pakistan Movement', subtopics: ['The decline of the Mughal Empire', 'The advent of the British and the situation of the Muslims', 'Sir Syed Ahmad Khan and the Aligarh Movement', 'The emergence of the Pakistan Movement'] },
      { name: 'The emergence of Pakistan 1906–47', subtopics: ['The main events of the Pakistan Movement', 'The roles of the key individuals'] },
      { name: 'Nationhood 1947–88', subtopics: ['The problems of Partition and the early years', 'The various governments', 'The role of the key individuals'] }
  ]
};

// Map subjects that share the same syllabus content for MCQs to avoid data duplication.
SUBJECT_TOPICS.physics_p1 = SUBJECT_TOPICS.physics_p2;
SUBJECT_TOPICS.chemistry_p1 = SUBJECT_TOPICS.chemistry_p2;
SUBJECT_TOPICS.islamiyat_p2 = SUBJECT_TOPICS.islamiyat_p1;
SUBJECT_TOPICS.pak_studies_p2 = SUBJECT_TOPICS.pak_studies_p1;
