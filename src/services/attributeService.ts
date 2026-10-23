import { supabase } from "../lib/supabase";

export interface AttributeType {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttributeValue {
  id: number;
  attribute_type_id: number;
  value: string;
  slug: string;
  active: boolean;
  created_at: string;
}

export interface AttributeTypeWithValues extends AttributeType {
  attribute_values: AttributeValue[];
}

export interface AttributeTypeInput {
  name: string;
  slug: string;
  active: boolean;
}

export interface AttributeValueInput {
  attribute_type_id: number;
  value: string;
  slug: string;
  active: boolean;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { generateSlug };

export async function fetchAllAttributeTypes(): Promise<AttributeTypeWithValues[]> {
  const { data, error } = await supabase
    .from("attribute_types")
    .select(
      `
      id, name, slug, active, created_at, updated_at,
      attribute_values ( id, attribute_type_id, value, slug, active, created_at )
    `
    )
    .order("name");

  if (error) throw error;
  return (data as AttributeTypeWithValues[]) || [];
}

export async function createAttributeType(input: AttributeTypeInput): Promise<AttributeType> {
  const { data, error } = await supabase
    .from("attribute_types")
    .insert([input])
    .select("id, name, slug, active, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updateAttributeType(
  id: number,
  input: Partial<AttributeTypeInput>
): Promise<void> {
  const { error } = await supabase
    .from("attribute_types")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

export async function createAttributeValue(input: AttributeValueInput): Promise<AttributeValue> {
  const { data, error } = await supabase
    .from("attribute_values")
    .insert([input])
    .select("id, attribute_type_id, value, slug, active, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updateAttributeValue(
  id: number,
  input: Partial<AttributeValueInput>
): Promise<void> {
  const { error } = await supabase
    .from("attribute_values")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

export async function fetchActiveAttributes(): Promise<AttributeTypeWithValues[]> {
  const { data, error } = await supabase
    .from("attribute_types")
    .select(`
      id,
      name,
      slug,
      active,
      created_at,
      updated_at,
      attribute_values (
        id,
        attribute_type_id,
        value,
        slug,
        active,
        created_at
      )
    `)
    .eq("active", true)
    .eq("attribute_values.active", true)
    .order("name");

  if (error) throw error;

  return (data as AttributeTypeWithValues[]) || [];
}


