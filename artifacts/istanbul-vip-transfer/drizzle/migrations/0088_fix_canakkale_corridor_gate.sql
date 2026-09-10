UPDATE intercity_toll_corridor_alternative_items AS item
SET entry_gate_name = 'malkara'
FROM intercity_toll_corridor_alternatives AS alternative,
     intercity_toll_corridors AS corridor,
     locations AS destination
WHERE item.alternative_id = alternative.id
  AND alternative.corridor_id = corridor.id
  AND corridor.destination_location_id = destination.id
  AND destination.slug = 'il-canakkale'
  AND item.entry_gate_name = 'Malkara'
  AND item.exit_gate_name = '1915canakkale-koprusu';