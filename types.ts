
export type Language = 'en' | 'bn';

export interface UserProfile {
  id: string;
  name: string;
  subject: string;
  password?: string;
  profilePic?: string;
  notes?: string;
}

export interface ClassRoutine {
  id: string;
  time: string;
  className: string;
  section: string;
  subject: string;
  homework: string;
  alarmActive: boolean;
  alarmMusic?: string;
}

export interface SectionMapping {
  [key: string]: string[];
}

export const SECTIONS: SectionMapping = {
  '6': ['পদ্মা', 'মেঘনা'],
  '7': ['গোলাপ', 'শাপলা'],
  '8': ['ময়না', 'টিয়া'],
  '9': ['বিজ্ঞান', 'মানবিক'],
  '10': ['বিজ্ঞান', 'মানবিক']
};