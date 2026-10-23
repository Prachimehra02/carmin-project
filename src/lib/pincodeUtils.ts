export interface PincodeLookupResult {
  valid: boolean;
  state: string;
  stateCode: string;
  district: string;
  error?: string;
}

interface PostalPincodeResponse {
  Message: string;
  Status: string;
  PostOffice: Array<{
    Name: string;
    District: string;
    State: string;
    Pincode: string;
  }> | null;
}

const STATE_CODE_MAP: Record<string, string> = {
  'Jammu and Kashmir': '01',
  'Himachal Pradesh': '02',
  'Punjab': '03',
  'Chandigarh': '04',
  'Uttarakhand': '05',
  'Haryana': '06',
  'Delhi': '07',
  'Rajasthan': '08',
  'Uttar Pradesh': '09',
  'Bihar': '10',
  'Sikkim': '11',
  'Arunachal Pradesh': '12',
  'Nagaland': '13',
  'Manipur': '14',
  'Mizoram': '15',
  'Tripura': '16',
  'Meghalaya': '17',
  'Assam': '18',
  'West Bengal': '19',
  'Jharkhand': '20',
  'Odisha': '21',
  'Chhattisgarh': '22',
  'Madhya Pradesh': '23',
  'Gujarat': '24',
  'Daman and Diu': '25',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Maharashtra': '27',
  'Andhra Pradesh': '37',
  'Karnataka': '29',
  'Goa': '30',
  'Lakshadweep': '31',
  'Kerala': '32',
  'Tamil Nadu': '33',
  'Puducherry': '34',
  'Andaman and Nicobar Islands': '35',
  'Telangana': '36',
  'Ladakh': '38',
  'Other Territory': '97',
  'Centre Jurisdiction': '99',
};

export function getStateCode(stateName: string): string {
  return STATE_CODE_MAP[stateName] || '';
}

export async function lookupPincode(pincode: string): Promise<PincodeLookupResult> {
  const cleanPin = pincode.trim();

  if (!/^\d{6}$/.test(cleanPin)) {
    return { valid: false, state: '', stateCode: '', district: '', error: 'PIN code must be exactly 6 digits' };
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (!response.ok) {
      return { valid: false, state: '', stateCode: '', district: '', error: 'Unable to verify PIN code. Please check your connection.' };
    }

    const data: PostalPincodeResponse[] = await response.json();
    const result = data[0];

    if (!result || result.Status !== 'Success' || !result.PostOffice || result.PostOffice.length === 0) {
      return { valid: false, state: '', stateCode: '', district: '', error: 'Invalid PIN code. Please check and try again.' };
    }

    const firstPostOffice = result.PostOffice[0];
    const state = firstPostOffice.State;
    const district = firstPostOffice.District;
    const stateCode = getStateCode(state);

    return {
      valid: true,
      state,
      stateCode,
      district,
    };
  } catch {
    return { valid: false, state: '', stateCode: '', district: '', error: 'Unable to verify PIN code. Please try again.' };
  }
}
