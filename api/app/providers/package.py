"""Package registry providers: PyPI, npm, crates.io, Maven, Go."""

from __future__ import annotations

from typing import Any

import httpx


class PyPIProvider:
    name = "pypi"

    async def get_metadata(self, package: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"https://pypi.org/pypi/{package}/json")
            resp.raise_for_status()
            info = resp.json().get("info", {})
        return {
            "name": info.get("name", package),
            "latest_version": info.get("version"),
            "summary": info.get("summary"),
            "home_page": info.get("home_page"),
            "project_urls": info.get("project_urls", {}),
            "requires_python": info.get("requires_python"),
        }


class NpmProvider:
    name = "npm"

    async def get_metadata(self, package: str) -> dict[str, Any]:
        enc = package.replace("/", "%2F")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"https://registry.npmjs.org/{enc}")
            resp.raise_for_status()
            body = resp.json()
        latest = body.get("dist-tags", {}).get("latest", "")
        return {"name": package, "latest_version": latest, "description": body.get("description")}


class CrateIoProvider:
    name = "crates_io"

    async def get_metadata(self, package: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"https://crates.io/api/v1/crates/{package}")
            resp.raise_for_status()
            crate = resp.json().get("crate", {})
        return {"name": crate.get("name", package), "latest_version": crate.get("max_version"), "description": crate.get("description")}


class MavenProvider:
    name = "maven"

    async def get_metadata(self, package: str) -> dict[str, Any]:
        group, _, artifact = package.rpartition(":")
        if not artifact:
            return {"name": package}
        url = f"https://search.maven.org/solrsearch/select?q=g:{group}+AND+a:{artifact}&rows=1&wt=json"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            doc = resp.json().get("response", {}).get("docs", [{}])[0]
        return {"name": package, "latest_version": doc.get("latestVersion"), "description": doc.get("description")}


def build_package_provider(ecosystem: str):
    mapping = {
        "pypi": PyPIProvider,
        "npm": NpmProvider,
        "crates.io": CrateIoProvider,
        "maven": MavenProvider,
    }
    return mapping.get(ecosystem, PyPIProvider)()