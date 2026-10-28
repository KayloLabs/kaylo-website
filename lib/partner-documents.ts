export const documentNames: Record<string, string> = {
  photo: 'Profile photo', aadhaar_front: 'Aadhaar · front', aadhaar_back: 'Aadhaar · back',
  police_certificate: 'Police certificate', selfie: 'Identity selfie',
  medical_council_reg: 'Medical council registration', medical_degree: 'Medical qualification',
  clinic_proof: 'Clinic / practice address', caregiver_cert: 'Caregiver training certificate',
};

/** This list mirrors the server's required evidence, not a licence guarantee. */
export function requiredDocuments(role?: string): string[] {
  switch (role) {
    case 'doctor': return ['clinic_proof', 'medical_council_reg', 'medical_degree', 'photo', 'selfie'];
    case 'caregiver': return ['aadhaar_back', 'aadhaar_front', 'caregiver_cert', 'photo', 'selfie'];
    default: return ['aadhaar_back', 'aadhaar_front', 'photo', 'police_certificate', 'selfie'];
  }
}
