export function HeroVisual() {
  return (
    <div className="hero-strip-stage">
      <div className="ring-bg">
        <div className="ring ring-1" />
        <div className="ring ring-2" />
        <div className="ring ring-3" />
      </div>

      <div className="strips-fan">
        <div className="fan-card card-light-gray">
          <div className="card-header">
            <span className="card-brand">NUVO</span>
            <span className="card-num">001</span>
          </div>
          <div className="card-photos">
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=400&q=80"
                alt="Heart hands sunset"
                loading="lazy"
              />
            </div>
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="Smiling portrait"
                loading="lazy"
              />
            </div>
          </div>
          <div className="card-footer">
            <p className="handwriting">always in sync</p>
            <p className="subtext">meet me on the other side</p>
          </div>
        </div>

        <div className="fan-card card-white">
          <div className="card-header">
            <span className="card-brand">NUVO</span>
            <span className="card-num">001</span>
          </div>
          <div className="card-photos">
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80"
                alt="Stylish girl red top"
                loading="lazy"
              />
            </div>
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
                alt="Portrait moment"
                loading="lazy"
              />
            </div>
          </div>
          <div className="card-footer">
            <p className="handwriting">a tiny moment</p>
            <p className="subtext">Distance is just a number</p>
          </div>
        </div>

        <div className="fan-card card-black">
          <div className="card-header">
            <span className="card-brand">NUVO</span>
            <span className="card-num">001</span>
          </div>
          <div className="card-photos">
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80"
                alt="Friends together"
                loading="lazy"
              />
            </div>
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
                alt="Smiling guy in hat"
                loading="lazy"
              />
            </div>
          </div>
          <div className="card-footer">
            <p className="handwriting">Friends Reunion!</p>
            <p className="subtext date-sub">14.02.2025</p>
          </div>
        </div>

        <div className="fan-card card-charcoal">
          <div className="card-header">
            <span className="card-brand">NUVO</span>
            <span className="card-num">001</span>
          </div>
          <div className="card-photos">
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=400&q=80"
                alt="Friends laughing"
                loading="lazy"
              />
            </div>
            <div className="photo-slot">
              <img
                src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80"
                alt="Cheerful moment"
                loading="lazy"
              />
            </div>
          </div>
          <div className="card-footer">
            <p className="handwriting">sweet memory</p>
            <p className="subtext">captured forever</p>
          </div>
        </div>
      </div>
    </div>
  )
}
