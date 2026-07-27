async function testSearch() {
  const query = 'September Earth Wind Fire';
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  console.log('Searching YouTube for:', query);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
    }
  });
  
  const html = await response.text();
  console.log('HTML length:', html.length);
  
  // Extract ytInitialData JSON
  const match = html.match(/ytInitialData\s*=\s*({.+?});/) || html.match(/ytInitialData\s*=\s*({.+?})\s*</);
  if (!match) {
    console.log('Could not find ytInitialData in HTML.');
    return;
  }
  
  try {
    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
    
    const videoItem = contents.find(item => item.videoRenderer);
    if (!videoItem) {
      console.log('No videoRenderer found in contents.');
      return;
    }
    
    const video = videoItem.videoRenderer;
    const videoId = video.videoId;
    const title = video.title?.runs?.[0]?.text;
    const channel = video.ownerText?.runs?.[0]?.text;
    const thumbnail = video.thumbnail?.thumbnails?.[0]?.url;
    
    console.log('Search Result:');
    console.log('- Video ID:', videoId);
    console.log('- Title:', title);
    console.log('- Channel (Artist):', channel);
    console.log('- Thumbnail:', thumbnail);
    console.log('- Watch URL:', `https://www.youtube.com/watch?v=${videoId}`);
  } catch (err) {
    console.error('Error parsing JSON:', err);
  }
}

testSearch();
