CREATE TABLE "intercity_toll_corridors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "origin_side" "istanbul_side" NOT NULL,
  "destination_location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "intercity_toll_corridor_unique" UNIQUE ("origin_side","destination_location_id")
);--> statement-breakpoint
CREATE TABLE "intercity_toll_corridor_alternatives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "corridor_id" uuid NOT NULL REFERENCES "intercity_toll_corridors"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "display_order" integer NOT NULL DEFAULT 0,
  "needs_review" boolean NOT NULL DEFAULT false,
  "review_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "intercity_toll_corridor_alternative_one_default_unique" ON "intercity_toll_corridor_alternatives" ("corridor_id") WHERE "is_default" = true;--> statement-breakpoint
CREATE TABLE "intercity_toll_corridor_alternative_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "alternative_id" uuid NOT NULL REFERENCES "intercity_toll_corridor_alternatives"("id") ON DELETE CASCADE,
  "toll_point_id" uuid NOT NULL REFERENCES "toll_points"("id") ON DELETE RESTRICT,
  "display_order" integer NOT NULL DEFAULT 0,
  "entry_gate_name" text,
  "exit_gate_name" text,
  CONSTRAINT "intercity_toll_corridor_alternative_item_unique" UNIQUE ("alternative_id","toll_point_id")
);--> statement-breakpoint
-- Only official, verified alternatives are seeded. Prices remain in toll_tariffs.
DO $$
DECLARE c uuid; a uuid;
BEGIN
  FOR c IN SELECT id FROM intercity_toll_corridors LOOP
    DELETE FROM intercity_toll_corridor_alternative_items WHERE alternative_id IN (SELECT id FROM intercity_toll_corridor_alternatives WHERE corridor_id=c);
    DELETE FROM intercity_toll_corridor_alternatives WHERE corridor_id=c;
  END LOOP;
  DELETE FROM intercity_toll_corridors;
  INSERT INTO intercity_toll_corridors(origin_side,destination_location_id)
    SELECT 'EUROPEAN', id FROM locations WHERE slug IN ('il-bursa','il-izmir','il-sakarya','il-canakkale') AND type='PROVINCE';

  -- Bursa: each route includes one Istanbul crossing and the existing Osmangazi flat point.
  INSERT INTO intercity_toll_corridor_alternatives(corridor_id,name,is_default,display_order)
    SELECT c.id,v.name,v.ord=1,v.ord FROM intercity_toll_corridors c
    CROSS JOIN (VALUES ('YSS + Osmangazi üzerinden',1,'YSS'),('FSM + Osmangazi üzerinden',2,'FSM'),('Avrasya + Osmangazi üzerinden',3,'AVRASYA')) v(name,ord,bridge)
    WHERE c.destination_location_id=(SELECT id FROM locations WHERE slug='il-bursa');
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order)
    SELECT a.id,tp.id,1 FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name=CASE WHEN a.name LIKE 'YSS%' THEN 'Yavuz Sultan Selim Köprüsü (YSS)' WHEN a.name LIKE 'FSM%' THEN 'Fatih Sultan Mehmet Köprüsü (FSM)' ELSE 'Avrasya Tüneli' END WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-bursa'));
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order)
    SELECT a.id,tp.id,2 FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name='Osmangazi Köprüsü' WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-bursa'));

  -- Izmir: official Istanbul–Izmir gate pair plus the selected Istanbul-side crossing.
  INSERT INTO intercity_toll_corridor_alternatives(corridor_id,name,is_default,display_order)
    SELECT c.id,v.name,v.ord=1,v.ord FROM intercity_toll_corridors c CROSS JOIN (VALUES ('YSS + İstanbul-İzmir Otoyolu',1),('FSM + İstanbul-İzmir Otoyolu',2),('Avrasya + İstanbul-İzmir Otoyolu',3)) v(name,ord)
    WHERE c.destination_location_id=(SELECT id FROM locations WHERE slug='il-izmir');
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order)
    SELECT a.id,tp.id,1 FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name=CASE WHEN a.name LIKE 'YSS%' THEN 'Yavuz Sultan Selim Köprüsü (YSS)' WHEN a.name LIKE 'FSM%' THEN 'Fatih Sultan Mehmet Köprüsü (FSM)' ELSE 'Avrasya Tüneli' END WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-izmir'));
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order,entry_gate_name,exit_gate_name)
    SELECT a.id,tp.id,2,'GEBZE','İZMİR' FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name LIKE 'İstanbul–İzmir Otoyolu%' WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-izmir'));

  -- Sakarya intentionally has no Avrasya-only alternative.
  INSERT INTO intercity_toll_corridor_alternatives(corridor_id,name,is_default,display_order)
    SELECT c.id,v.name,v.ord=1,v.ord FROM intercity_toll_corridors c CROSS JOIN (VALUES ('YSS + KMO üzerinden',1),('FSM + KMO üzerinden',2)) v(name,ord)
    WHERE c.destination_location_id=(SELECT id FROM locations WHERE slug='il-sakarya');
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order)
    SELECT a.id,tp.id,1 FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name=CASE WHEN a.name LIKE 'YSS%' THEN 'Yavuz Sultan Selim Köprüsü (YSS)' ELSE 'Fatih Sultan Mehmet Köprüsü (FSM)' END WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-sakarya'));
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order,entry_gate_name,exit_gate_name)
    SELECT a.id,tp.id,2,'KURNAKÖY 2','ADAPAZARI-1' FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name LIKE 'Kuzey Marmara Otoyolu%' WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-sakarya'));

  -- One combined official 1915 route point prevents double counting the bridge.
  INSERT INTO intercity_toll_corridor_alternatives(corridor_id,name,is_default,display_order)
    SELECT id,'1915 Çanakkale Otoyolu ve Köprüsü',true,1 FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-canakkale');
  INSERT INTO intercity_toll_corridor_alternative_items(alternative_id,toll_point_id,display_order,entry_gate_name,exit_gate_name)
    SELECT a.id,tp.id,1,'Malkara','1915canakkale-koprusu' FROM intercity_toll_corridor_alternatives a JOIN toll_points tp ON tp.name LIKE '1915 Çanakkale Otoyolu ve Köprüsü%' WHERE a.corridor_id=(SELECT id FROM intercity_toll_corridors WHERE destination_location_id=(SELECT id FROM locations WHERE slug='il-canakkale'));
END $$;