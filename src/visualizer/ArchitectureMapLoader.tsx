import { useState } from "react";

import { ArchitectureMapFromJson } from "./ArchitectureMapFromJson.js";

export const ArchitectureMapLoader = () => {
  const [json, setJson] = useState<string>();

  return (
    <section>
      <label>
        Load architecture graph
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Load architecture graph"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) {
              setJson(await file.text());
            }
          }}
        />
      </label>
      {json ? (
        <ArchitectureMapFromJson json={json} />
      ) : (
        <p>Select an architecture graph JSON file.</p>
      )}
    </section>
  );
};
