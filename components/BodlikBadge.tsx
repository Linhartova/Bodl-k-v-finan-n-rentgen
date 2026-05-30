// Maskot Bodlík se sloganem "Bodlíkův finanční rentgen" – fixní v rohu obrazovky.
// Dekorativní (nezachytává kliknutí), na úzkých displejích se skryje.
export default function BodlikBadge() {
  return (
    <div className="bodlik-badge" aria-hidden="true">
      <div className="bodlik-slogan">
        Bodlíkův
        <br />
        finanční rentgen
      </div>
      <img className="bodlik-img" src="/bodlik.png" alt="" />
    </div>
  );
}
