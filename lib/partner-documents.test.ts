import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requiredDocuments, documentNames} from './partner-documents.ts';
test('Care review requests only documents belonging to the application role', () => {
  assert.deepEqual(requiredDocuments('doctor'), ['clinic_proof','medical_council_reg','medical_degree','photo','selfie']);
  assert.deepEqual(requiredDocuments('caregiver'), ['aadhaar_back','aadhaar_front','caregiver_cert','photo','selfie']);
  assert.deepEqual(requiredDocuments(), requiredDocuments('worker'));
  for (const role of ['doctor','caregiver','worker']) {
    const types=requiredDocuments(role);
    assert.equal(new Set(types).size,5);
    assert.ok(types.every(t=>documentNames[t]));
  }
});
