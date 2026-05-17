const { fetchAll } = require('../services/fetchService');

async function fetchServiceTest() {
    // search term
    const searchQuery = 'cat';
    
    try {
        console.log(`Fetching data for query: "${searchQuery}"...`);
        const result = await fetchAll(searchQuery);
        console.log('\nSUCCESS: Result:\n');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\nERROR: Message:', error.message);
    }
}

fetchServiceTest();