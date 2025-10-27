# Clipper 2.0 Savings Calculator

Today, the Bay Area's transportation system is split into 27 different agencies serving different areas with different modes of transportation. Rail agencies operate separately from bus agencies, bus agencies stop at the county line or city line, and the entire system is fragmented and hard to get around.

The Clipper 2.0 Savings Calculator celebrates the coming implementation of the new Clipper 2.0 fare payment system, which will allow contactless card payments, as well as a system of effectively "free" transfers between different agencies: instead of the current 218 existing transfer rules, often a simple $0.50 discount at best, one simple rule will be in effect, with up to a $2.85 discount every time a rider tags onto a new vehicle.

### Development

Start the app in dev mode:

`$ npx tsc app/app.ts --outDir public/ --target es2020 --watch`

Then start a webserver in the `public/` directory:

`$ $ python -m http.server -d public/`

### Data sources

Data for the existing fares and transfer schemes are taken from the Metropolitan Transportation Commission's [regional GTFS feed](https://511.org/open-data/transit), in particular, the `fare_*` files. In addition, the section of `stops.txt` defining BART stops has been imported as well.
