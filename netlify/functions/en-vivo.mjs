// Netlify Function: dice si el canal de YouTube de Ipechi Renca está transmitiendo en vivo

const CHANNEL_ID = "UCaYwKGwfWfOMbIbzUOMgY7Q";
const UPLOADS_PLAYLIST_ID = "UU" + CHANNEL_ID.slice(2);

const respuesta = (cuerpo, segundosCache) =>
	new Response(JSON.stringify(cuerpo), {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			// El navegador guarda 30 s y el CDN de Netlify 60 s: así, aunque entren
			// muchas personas a la vez, YouTube se consulta como máximo 1 vez por minuto.
			"Cache-Control": `public, max-age=30`,
			"Netlify-CDN-Cache-Control": `public, s-maxage=${segundosCache}, stale-while-revalidate=60`,
		},
	});

export default async function handler() {
	const key = process.env.YOUTUBE_API_KEY;
	if (!key) return respuesta({ live: false, error: "sin_api_key" }, 60);

	try {
		// 1) Últimos videos del canal (las transmisiones en vivo aparecen aquí al iniciar)
		const r1 = await fetch(
			`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=5&key=${key}`
		);
		const d1 = await r1.json();
		const ids = (d1.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean);
		if (ids.length === 0) return respuesta({ live: false }, 60);

		// 2) ¿Alguno está en vivo ahora mismo?
		const r2 = await fetch(
			`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids.join(",")}&key=${key}`
		);
		const d2 = await r2.json();
		const enVivo = (d2.items ?? []).find((v) => v.snippet?.liveBroadcastContent === "live");

		if (!enVivo) return respuesta({ live: false }, 60);

		return respuesta(
			{
				live: true,
				id: enVivo.id,
				title: enVivo.snippet.title,
				thumbnail:
					enVivo.snippet.thumbnails?.maxres?.url ??
					enVivo.snippet.thumbnails?.high?.url ??
					enVivo.snippet.thumbnails?.medium?.url ??
					null,
				startedAt: enVivo.liveStreamingDetails?.actualStartTime ?? null,
			},
			60
		);
	} catch (error) {
		return respuesta({ live: false, error: "fallo_consulta" }, 30);
	}
}
