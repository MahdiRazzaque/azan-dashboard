import("node-fetch")

// Function to fetch data from the API
async function fetchMasjidTimings() {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1

    try {
        const response = await fetch("https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=03b8d82c-5b0e-4cb9-ad68-8c7e204cae00");
        
        const data = await response.json();

        const salahTimings = (data.model.salahTimings);

        console.log(salahTimings.filter(obj => obj.day === todayDay && obj.month === todayMonth));
    } catch (error) {
        console.log("Error fetching data:", error);
    }
}

fetchMasjidTimings();
