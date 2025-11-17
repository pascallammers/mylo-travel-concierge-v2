// Quick script to find missing user IDs
const allSupabaseIds = ["81f4b45f-13a2-40f4-bac4-eec6bed45102","6f2997da-5277-4673-8349-b304a483738d","1055a51f-559d-48f9-83a0-68444b292a53","15da411a-dc7e-4fb5-a1f0-843903dfd054","709badba-fee2-4637-9f52-f8d452af2e28","ab2aaa7f-9a34-4be0-888b-a04fd4f48f08","aa7fa135-2dd9-49f9-9516-e97768194afa","0c51e843-0763-4833-a1ea-e6931f17d8e3","0425930a-ca24-4fe5-9ae7-11bd34376dff","081411f3-b1a5-41d1-bfeb-66fdf1719430","9ddd51ec-a2fa-4aab-8eed-9b1d7ee18675","d940e1c1-5c0b-49a9-b06d-169d6367d6a3","3dcff068-45dd-4da9-b493-72e0712a708c","3fff0494-9c99-48fb-bdd6-3fc657bec557","123c860a-d5e4-4a11-bd3e-1561f4d90696","346de23a-8e93-401a-a142-fc9578a97d1c","c4baf33a-b411-4466-ac8a-b28849ba681d","f8545f5a-0b37-42aa-8c9e-c0478a06101f","a551d454-fd84-4f6e-9769-3641b90f207e","11dc37ad-dbf8-433b-b0b0-fe02f4cb5a1d","33a513ae-039b-4d02-9c3f-79ae456279ec","4c236a80-217d-4cd1-b09c-77da3a63b1a1","5d3fe8a1-3f47-4517-8e42-fa954260ce72","c801867c-89f0-4b2a-a842-ce95cfec997c","e5258a39-533d-4912-8a4b-f77b9400d296","b8e54d9a-e7d2-4003-be97-f1074afba64a","6e90b60c-9ea5-4282-ae86-fae852efa53e","aacf7327-8b7e-4520-8c11-921b0f36dab4","43e1c4c4-e4a0-4467-b4a7-25c5ec2faab6","e0fc4971-69ff-4df3-bcdb-f0074e7b04b0","9a042de9-0b5c-417c-a68c-9952048e1af4","fd8bfc20-fdfc-4bb3-bd72-a7440c1cf63e","1c4d6e89-546f-4350-9052-8f6bcdaa5b6b","3fb609a0-a523-4baa-98a3-5ed8008a0d30","259a74ee-28ed-4cbd-9642-af9739015021","bd6dcc3f-d8c7-4db6-8042-135113eace34","b2f03a20-c37b-4339-bb16-959c315ca38a","7a4382d5-e799-40f2-a75d-b7309b521342","b0fb7756-87c5-4321-b45f-1328cabf5044","c6ae1d1f-78b6-4dd4-9d92-6e7db60f3462","e1e749ec-6e45-405a-b9bd-775e00f836e5","baf1267c-6dfd-4770-a856-7b94f5367327","c1ece80c-9dfe-4c63-b47c-5b51c6a65dbb","880ea12d-eb9c-412a-a26a-e3d5ebb60940","f0d11ff6-1b0b-4b7d-bb02-df9acd025887","471311f5-2981-456a-8932-e3d828cd9169","f9205e37-8e66-434a-bbad-0779ee531fb7","f02426cc-5260-41c8-bf91-54a6d4a338d8","6eac7a55-ba80-4c86-ae97-7e0cfdabefc6","80c8884f-1980-456a-abe6-be4189b097b1","f07e6c7e-b540-48ee-920e-bc9cd3f2852d","5978e337-95c9-4523-9979-44058779ef5f","358fb40f-bfba-4e2d-b578-828ab2ac7642","12400507-c5aa-45b1-a2ad-b69b9b9c1d2d","e95971e1-2eff-4f41-be93-9ef8737ee1df","8c0f7731-e165-43ba-9aff-f71ef0a7f1ab","2bd0a340-0c3e-4b93-8bdf-5ef42b3c91bf","b1c14797-c33a-4618-b4c9-349f0a44711b","36fce460-5b7d-448f-9953-f898973c169e","5e74a72a-05da-429f-8dc9-449c5133ad3b"];

// Create batches of 20
const batches = [];
for (let i = 0; i < allSupabaseIds.length; i += 20) {
  batches.push(allSupabaseIds.slice(i, i + 20));
}

console.log(`Total IDs: ${allSupabaseIds.length}`);
console.log(`Total batches: ${batches.length}`);
console.log('\nFirst 60 IDs (3 batches):');
batches.slice(0, 3).forEach((batch, idx) => {
  console.log(`\nBatch ${idx + 1}:`);
  console.log(`'${batch.join("','")}'`);
});
