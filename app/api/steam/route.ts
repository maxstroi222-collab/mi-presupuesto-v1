import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Nombre necesario' }, { status: 400 });
  }

  try {
    // ID 730 = CS2. Currency 3 = Euros.
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${encodeURIComponent(name)}`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error de conexión con Steam' }, { status: 500 });
  }
}
