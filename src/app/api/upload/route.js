import { upload } from '@/app/api/upload/supabaseUpload';
import { NextResponse } from 'next/server';
import { extractDocumentContent } from './documentHandler';
import { createClient } from '@supabase/supabase-js';

const apiURL = process.env.SUPABASE_URL;
const apiKey = process.env.SUPABASE_API_KEY;
const supabase = createClient(apiURL, apiKey);

export const POST = async (req) => {
  const form = await req.formData();
  const file = form.get('file');

  const docContent = await extractDocumentContent(file);

  return await upload(supabase, file)
    .then(async (res) => {
      const {
        data: documentData,
        error,
        count
      } = await supabase
        .from(process.env.SUPABASE_DOCUMENTS_TABLE)
        .select('checksum', {
          count: 'exact'
        })
        .eq('checksum', res.path);

      if (error) {
        console.error(error);
        return errorResponse();
      }

      if (count) {
        return NextResponse.json({ status: 200, ...documentData?.[0] });
      }

      await insertNewDocument({
        fileName: file.name,
        checksum: res.path,
        docContent
      });

      return NextResponse.json({ status: 200, checksum: res.path });
    })
    .catch((error) => {
      console.error(error);
      return errorResponse();
    });
};

const insertNewDocument = async ({ fileName, checksum, docContent }) => {
  const { error } = await supabase
    .from(process.env.SUPABASE_DOCUMENTS_TABLE)
    .insert({
      checksum: checksum,
      document_name: fileName
    });

  if (error) {
    console.error(error);
    return errorResponse();
  }

  const { error: contentError } = await supabase
    .from(process.env.SUPABASE_DOCUMENTS_CONTENT_TABLE)
    .insert([{ checksum: checksum, text_content: docContent }]);

  if (contentError) {
    console.error(contentError);
    return errorResponse();
  }
};

const errorResponse = (error) => {
  return NextResponse.json({ status: 500, error });
};
