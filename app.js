// import { PineconeClient } from "@pinecone-database/pinecone";
const { PineconeClient } = require("@pinecone-database/pinecone");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();

const port = process.env.PORT || 3001;

const pinecone = new PineconeClient();

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const jsonParser = bodyParser.json();

app.post("/generate-vector", jsonParser, async (req, res) => {
  console.log("/generate-vector is called!");

  const { sentences, filterId } = req.body;

  console.log("filterId", filterId);

  await pinecone.init({
    environment: "us-east1-gcp",
    apiKey: process.env.PINECONE_KEY,
  });

  const index = pinecone.Index("test-index");

  const textArray = sentences.map((t) => t.text);

  let i = 0;
  const vectorPayload = [];
  console.log("Start: Calling Open AI embeddings API...");
  for (const sentence of textArray) {
    console.log(`Number: ${i}`);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: sentence,
        model: "text-embedding-ada-002",
      }),
    });

    const json = await res.json();

    vectorPayload.push({
      id: `${filterId}-${i}`,
      values: json.data[0].embedding,
      metadata: {
        text: sentence,
        filterId,
      },
    });

    i++;
  }

  console.log("Upsert to Pinecone...");
  const upsertResponse = await index.upsert({
    upsertRequest: {
      vectors: vectorPayload,
      namespace: "example-namespace",
    },
  });

  await supabaseAdmin
    .from("documents")
    .update({ is_generating_vector_data: false })
    .eq("filter_id", filterId);

  console.log("End: Request successfully done.");
  res.json({
    result: "ok",
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(err.message || "An error occurred!");
});

app.listen(port, () => {
  console.log(`App listening on port ${port}!`);
});
